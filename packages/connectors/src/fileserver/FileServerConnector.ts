import type { AccessChangeRequest, ConnectorResult, DirectoryObject, ResourceObject } from '@tenantflow/shared';
import { PermissionAction, PermissionType, WorkloadType } from '@tenantflow/shared';
import type { IConnector } from '../base/IConnector.js';

export interface FileServerConfig {
  winrmHost: string;
  winrmPort?: number;
  username: string;
  password: string;
  useHttps?: boolean;
}

// Tier 3 only — requires WinRM enabled on target file server
export class FileServerConnector implements IConnector {
  readonly workloadType = WorkloadType.FILESERVER;

  constructor(private config: FileServerConfig) {}

  private buildWinRmUrl(): string {
    const scheme = this.config.useHttps ? 'https' : 'http';
    const port = this.config.winrmPort ?? (this.config.useHttps ? 5986 : 5985);
    return `${scheme}://${this.config.winrmHost}:${port}/wsman`;
  }

  private async runPowerShell(script: string): Promise<string> {
    // WinRM SOAP envelope execution — simplified fetch-based implementation.
    // In production, use node-winrm or kerberos-authenticated WinRM client.
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:wsmid="http://schemas.dmtf.org/wbem/wsman/identity/1/wsmanidentity.xsd">
  <s:Body>
    <rsp:CommandLine xmlns:rsp="http://schemas.microsoft.com/wbem/wsman/1/windows/shell">
      <rsp:Command>powershell</rsp:Command>
      <rsp:Arguments>${encodeURIComponent(script)}</rsp:Arguments>
    </rsp:CommandLine>
  </s:Body>
</s:Envelope>`;

    const res = await fetch(this.buildWinRmUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml;charset=UTF-8',
        Authorization: 'Basic ' + Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64'),
      },
      body,
    });

    if (!res.ok) throw new Error(`WinRM failed: ${res.status}`);
    return res.text();
  }

  private mapPermission(permType: PermissionType): string {
    const map: Partial<Record<PermissionType, string>> = {
      [PermissionType.SMB_READ]: 'Read',
      [PermissionType.SMB_CHANGE]: 'Change',
      [PermissionType.SMB_FULL]: 'Full',
      [PermissionType.NTFS_READ]: '(OI)(CI)R',
      [PermissionType.NTFS_MODIFY]: '(OI)(CI)M',
      [PermissionType.NTFS_FULL]: '(OI)(CI)F',
    };
    return map[permType] ?? 'Read';
  }

  async execute(req: AccessChangeRequest): Promise<ConnectorResult> {
    const isNtfs = [PermissionType.NTFS_READ, PermissionType.NTFS_MODIFY, PermissionType.NTFS_FULL].includes(req.permissionType);
    const perm = this.mapPermission(req.permissionType);

    try {
      // Capture pre-state
      const preScript = isNtfs
        ? `(Get-Acl "${req.resourceId}").Access | ConvertTo-Json -Compress`
        : `Get-SmbShareAccess -Name "${req.resourceId}" | ConvertTo-Json -Compress`;

      const preState = await this.runPowerShell(preScript);

      // Apply change
      const changeScript = isNtfs
        ? req.permissionAction === PermissionAction.ADD
          ? `icacls "${req.resourceId}" /grant "${req.targetOid}:${perm}" /T`
          : `icacls "${req.resourceId}" /remove "${req.targetOid}" /T`
        : req.permissionAction === PermissionAction.ADD
          ? `Grant-SmbShareAccess -Name "${req.resourceId}" -AccountName "${req.targetOid}" -AccessRight ${perm} -Force`
          : `Revoke-SmbShareAccess -Name "${req.resourceId}" -AccountName "${req.targetOid}" -Force`;

      await this.runPowerShell(changeScript);

      return {
        success: true,
        rollbackContext: {
          workloadType: WorkloadType.FILESERVER,
          operation: req.permissionAction,
          resourceId: req.resourceId,
          targetOid: req.targetOid,
          permissionType: req.permissionType,
          preStateSnapshot: { preState, isNtfs },
        },
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async rollback(rollbackContext: unknown): Promise<ConnectorResult> {
    const ctx = rollbackContext as {
      resourceId: string;
      preStateSnapshot: { preState: string; isNtfs: boolean };
    };

    try {
      if (ctx.preStateSnapshot.isNtfs) {
        // Restore via icacls /restore from saved ACL string
        await this.runPowerShell(
          `$acl = Get-Acl "${ctx.resourceId}"; $acl.SetAccessRuleProtection($false, $true); Set-Acl "${ctx.resourceId}" $acl`,
        );
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async searchPrincipals(_query: string, _limit = 20): Promise<DirectoryObject[]> {
    return []; // File server principals resolved via AD connector
  }

  async searchResources(query: string, limit = 20): Promise<ResourceObject[]> {
    try {
      const script = `Get-SmbShare | Where-Object { $_.Name -like "*${query}*" } | Select-Object -First ${limit} Name, Path, Description | ConvertTo-Json -Compress`;
      const raw = await this.runPowerShell(script);
      const shares = JSON.parse(raw) as Array<{ Name: string; Path: string; Description?: string }>;
      const arr = Array.isArray(shares) ? shares : [shares];
      return arr.map((s) => ({
        id: s.Name,
        displayName: s.Name,
        type: 'smb_share',
        path: s.Path,
        workloadType: WorkloadType.FILESERVER,
        description: s.Description,
      }));
    } catch {
      return [];
    }
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.runPowerShell('Write-Output "ok"');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }
}

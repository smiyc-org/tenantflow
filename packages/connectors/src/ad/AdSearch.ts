import ldap from 'ldapjs';
import type { DirectoryObject, ResourceObject } from '@tenantflow/shared';
import { WorkloadType } from '@tenantflow/shared';
import type { AdClient } from './AdClient.js';

export class AdSearch {
  constructor(private client: AdClient) {}

  async searchPrincipals(ldapClient: ldap.Client, query: string, limit = 20): Promise<DirectoryObject[]> {
    const escaped = ldap.escapeDN(query);
    const filter = `(&(objectClass=user)(!(userAccountControl:1.2.840.113556.1.4.803:=2))(|(sAMAccountName=*${escaped}*)(cn=*${escaped}*)(mail=*${escaped}*)))`;

    const entries = await this.client.search(ldapClient, filter, [
      'objectGUID', 'sAMAccountName', 'displayName', 'mail', 'distinguishedName', 'objectSid',
    ]);

    return entries.slice(0, limit).map((e) => {
      const o = e.object as Record<string, string>;
      const sam = o['sAMAccountName'] ?? '';
      const dn = o['distinguishedName'] ?? '';
      return {
        id: o['objectGUID'] ?? sam,
        displayName: o['displayName'] ?? sam,
        type: 'user',
        email: o['mail'],
        sid: o['objectSid'],
        distinguishedName: dn,
        workloadType: WorkloadType.AD,
        disambiguator: `${sam} | ${dn.split(',').slice(-3).join(',')}`,
      } satisfies DirectoryObject;
    });
  }

  async searchResources(ldapClient: ldap.Client, query: string, limit = 20): Promise<ResourceObject[]> {
    const escaped = ldap.escapeDN(query);
    const filter = `(&(objectClass=group)(|(cn=*${escaped}*)(sAMAccountName=*${escaped}*)))`;

    const entries = await this.client.search(ldapClient, filter, [
      'objectGUID', 'cn', 'distinguishedName', 'description', 'groupType',
    ]);

    return entries.slice(0, limit).map((e) => {
      const o = e.object as Record<string, string>;
      const cn = o['cn'] ?? '';
      const dn = o['distinguishedName'] ?? '';
      return {
        id: dn,
        displayName: cn,
        type: 'security_group',
        path: dn,
        workloadType: WorkloadType.AD,
        description: o['description'],
      } satisfies ResourceObject;
    });
  }
}

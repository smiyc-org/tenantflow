import ldap from 'ldapjs';
import type { AdClient } from './AdClient.js';

export interface MembershipChange {
  groupDn: string;
  userDn: string;
  action: 'ADD' | 'REMOVE';
}

export interface MembershipSnapshot {
  groupDn: string;
  membersBefore: string[];
}

export class AdGroupManager {
  constructor(private client: AdClient) {}

  async getMembers(ldapClient: ldap.Client, groupDn: string): Promise<string[]> {
    const entries = await this.client.search(
      ldapClient,
      `(distinguishedName=${ldap.escapeDN(groupDn)})`,
      ['member'],
    );
    const entry = entries[0];
    if (!entry) return [];
    const raw = entry.object['member'];
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
  }

  async addMember(
    ldapClient: ldap.Client,
    groupDn: string,
    userDn: string,
  ): Promise<MembershipSnapshot> {
    const before = await this.getMembers(ldapClient, groupDn);
    if (before.some((m) => m.toLowerCase() === userDn.toLowerCase())) {
      return { groupDn, membersBefore: before };
    }
    const change = new ldap.Change({
      operation: 'add',
      modification: new ldap.Attribute({ type: 'member', values: [userDn] }),
    });
    await this.client.modify(ldapClient, groupDn, change);
    return { groupDn, membersBefore: before };
  }

  async removeMember(
    ldapClient: ldap.Client,
    groupDn: string,
    userDn: string,
  ): Promise<MembershipSnapshot> {
    const before = await this.getMembers(ldapClient, groupDn);
    if (!before.some((m) => m.toLowerCase() === userDn.toLowerCase())) {
      return { groupDn, membersBefore: before };
    }
    const change = new ldap.Change({
      operation: 'delete',
      modification: new ldap.Attribute({ type: 'member', values: [userDn] }),
    });
    await this.client.modify(ldapClient, groupDn, change);
    return { groupDn, membersBefore: before };
  }

  async restoreMembers(
    ldapClient: ldap.Client,
    groupDn: string,
    members: string[],
  ): Promise<void> {
    const change = new ldap.Change({
      operation: 'replace',
      modification: new ldap.Attribute({ type: 'member', values: members }),
    });
    await this.client.modify(ldapClient, groupDn, change);
  }

  async resolveNestedMembership(
    ldapClient: ldap.Client,
    userDn: string,
    maxDepth: number,
  ): Promise<string[]> {
    const visited = new Set<string>();
    const queue = [userDn];
    const groups: string[] = [];

    for (let depth = 0; depth < maxDepth && queue.length > 0; depth++) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const entries = await this.client.search(
        ldapClient,
        `(member=${ldap.escapeDN(current)})`,
        ['distinguishedName'],
      );
      for (const e of entries) {
        const dn = e.object['distinguishedName'] as string;
        if (dn && !visited.has(dn)) {
          groups.push(dn);
          queue.push(dn);
        }
      }
    }

    return groups;
  }
}

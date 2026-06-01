import type { Client } from '@microsoft/microsoft-graph-client';

export interface MembershipSnapshot {
  groupId: string;
  wasPresent: boolean;
  targetId: string;
}

export class EntraGroupManager {
  constructor(private graph: Client) {}

  async isMember(groupId: string, userId: string): Promise<boolean> {
    try {
      await this.graph
        .api(`/groups/${groupId}/members/${userId}`)
        .select('id')
        .get();
      return true;
    } catch {
      return false;
    }
  }

  async addMember(groupId: string, userId: string): Promise<MembershipSnapshot> {
    const wasPresent = await this.isMember(groupId, userId);
    if (!wasPresent) {
      await this.graph.api(`/groups/${groupId}/members/$ref`).post({
        '@odata.id': `https://graph.microsoft.com/v1.0/directoryObjects/${userId}`,
      });
    }
    return { groupId, targetId: userId, wasPresent };
  }

  async removeMember(groupId: string, userId: string): Promise<MembershipSnapshot> {
    const wasPresent = await this.isMember(groupId, userId);
    if (wasPresent) {
      await this.graph.api(`/groups/${groupId}/members/${userId}/$ref`).delete();
    }
    return { groupId, targetId: userId, wasPresent };
  }

  async addOwner(groupId: string, userId: string): Promise<MembershipSnapshot> {
    const owners = await this.graph
      .api(`/groups/${groupId}/owners`)
      .select('id')
      .get() as { value: Array<{ id: string }> };
    const wasPresent = owners.value.some((o) => o.id === userId);
    if (!wasPresent) {
      await this.graph.api(`/groups/${groupId}/owners/$ref`).post({
        '@odata.id': `https://graph.microsoft.com/v1.0/directoryObjects/${userId}`,
      });
    }
    return { groupId, targetId: userId, wasPresent };
  }

  async removeOwner(groupId: string, userId: string): Promise<MembershipSnapshot> {
    await this.graph.api(`/groups/${groupId}/owners/${userId}/$ref`).delete();
    return { groupId, targetId: userId, wasPresent: true };
  }
}

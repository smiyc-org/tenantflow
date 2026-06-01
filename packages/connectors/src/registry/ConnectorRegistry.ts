import { WorkloadType } from '@tenantflow/shared';
import type { IConnector } from '../base/IConnector.js';

export class ConnectorRegistry {
  private connectors = new Map<WorkloadType, IConnector>();

  register(connector: IConnector): void {
    this.connectors.set(connector.workloadType as WorkloadType, connector);
  }

  get(workloadType: WorkloadType): IConnector {
    const c = this.connectors.get(workloadType);
    if (!c) throw new Error(`No connector registered for workload: ${workloadType}`);
    return c;
  }

  has(workloadType: WorkloadType): boolean {
    return this.connectors.has(workloadType);
  }

  all(): IConnector[] {
    return [...this.connectors.values()];
  }
}

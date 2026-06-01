import ldap from 'ldapjs';

export interface AdConfig {
  url: string;
  bindDn: string;
  bindPassword: string;
  baseDn: string;
  tlsEnabled?: boolean;
  nestedGroupMaxDepth?: number;
}

export class AdClient {
  private config: AdConfig;

  constructor(config: AdConfig) {
    this.config = config;
  }

  private createClient(): ldap.Client {
    return ldap.createClient({
      url: this.config.url,
      tlsOptions: this.config.tlsEnabled ? { rejectUnauthorized: true } : undefined,
      timeout: 10000,
      connectTimeout: 10000,
    });
  }

  async bind(): Promise<ldap.Client> {
    return new Promise((resolve, reject) => {
      const client = this.createClient();
      client.bind(this.config.bindDn, this.config.bindPassword, (err) => {
        if (err) { client.destroy(); reject(err); return; }
        resolve(client);
      });
    });
  }

  async search(client: ldap.Client, filter: string, attributes: string[]): Promise<ldap.SearchEntry[]> {
    return new Promise((resolve, reject) => {
      const entries: ldap.SearchEntry[] = [];
      client.search(
        this.config.baseDn,
        {
          filter,
          scope: 'sub',
          attributes,
          paged: { pageSize: 1000 },
          sizeLimit: 0,
        },
        (err, res) => {
          if (err) { reject(err); return; }
          res.on('searchEntry', (entry) => entries.push(entry));
          res.on('error', reject);
          res.on('end', () => resolve(entries));
        },
      );
    });
  }

  async modify(client: ldap.Client, dn: string, change: ldap.Change): Promise<void> {
    return new Promise((resolve, reject) => {
      client.modify(dn, change, (err) => {
        if (err) { reject(err); return; }
        resolve();
      });
    });
  }

  unbind(client: ldap.Client): void {
    try { client.unbind(); } catch { /* ignore */ }
  }

  get baseDn(): string { return this.config.baseDn; }
  get maxDepth(): number { return this.config.nestedGroupMaxDepth ?? 5; }
}

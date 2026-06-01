import { ActivityHandler, CardFactory, MessageFactory } from 'botbuilder';
import type { TurnContext } from 'botbuilder';
import axios from 'axios';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://api:3000';

export class AccessConciergeBot extends ActivityHandler {
  constructor() {
    super();

    this.onMessage(async (context) => {
      const text = context.activity.text?.trim().toLowerCase() ?? '';

      if (text.includes('help')) {
        await context.sendActivity(MessageFactory.text(
          '**TenantFloe** — I can help you:\n' +
          '• `approvals` — See your pending approvals\n' +
          '• `status <request-number>` — Check request status\n' +
          '• Open the portal for new requests: ' + (process.env['PORTAL_URL'] ?? 'https://concierge.corp.local'),
        ));
      } else if (text.startsWith('status ')) {
        const num = text.replace('status ', '').toUpperCase();
        await this.handleStatusCheck(context, num);
      } else {
        await context.sendActivity(
          'Hi! Type `help` to see what I can do, or visit the portal to submit a new access request.',
        );
      }
    });

    // Handle Adaptive Card Action.Execute (approve/reject invokes)
    this.onInvokeActivity(async (context) => {
      if (context.activity.name === 'adaptiveCard/action') {
        return this.handleCardAction(context);
      }
      return { status: 200 };
    });
  }

  private async handleStatusCheck(context: TurnContext, requestNumber: string): Promise<void> {
    try {
      const res = await axios.get(`${API_BASE}/requests?requestNumber=${requestNumber}`);
      const request = res.data?.items?.[0];
      if (!request) {
        await context.sendActivity(`Request ${requestNumber} not found.`);
        return;
      }
      await context.sendActivity(
        `**${request.request_number}** — Status: **${request.status}**\n` +
        `Workload: ${request.workload_type} · ${request.resource_display}`,
      );
    } catch {
      await context.sendActivity('Could not retrieve request status. Please check the portal.');
    }
  }

  private async handleCardAction(context: TurnContext): Promise<object> {
    const action = context.activity.value as { action?: { verb?: string; data?: { token?: string }; inputs?: { comment?: string } } };
    const verb = action.action?.verb;
    const token = action.action?.data?.token;
    const comment = action.action?.inputs?.comment;

    if (!token) return { status: 400 };

    try {
      await axios.post(`${API_BASE}/approvals/${token}/${verb}`, { comment });

      const successMsg = verb === 'approve'
        ? '✅ Approved! The access change will be applied shortly.'
        : '❌ Rejected. The requester has been notified.';

      return {
        statusCode: 200,
        type: 'application/vnd.microsoft.card.adaptive',
        value: {
          type: 'AdaptiveCard',
          version: '1.4',
          body: [{ type: 'TextBlock', text: successMsg, color: verb === 'approve' ? 'Good' : 'Warning' }],
        },
      };
    } catch {
      return {
        statusCode: 200,
        type: 'application/vnd.microsoft.card.adaptive',
        value: {
          type: 'AdaptiveCard',
          version: '1.4',
          body: [{ type: 'TextBlock', text: '⚠️ Action failed. Please try in the portal.', color: 'Attention' }],
        },
      };
    }
  }

  async sendApprovalCard(
    serviceUrl: string,
    conversationId: string,
    cardData: object,
  ): Promise<void> {
    // Used by notification worker to proactively send cards
    void serviceUrl; void conversationId; void cardData;
    // In production, use ConnectorClient with bot credentials to post proactively
  }
}

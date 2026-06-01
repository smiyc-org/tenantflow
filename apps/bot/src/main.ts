import express from 'express';
import { BotFrameworkAdapter } from 'botbuilder';
import { AccessConciergeBot } from './bot.js';

const adapter = new BotFrameworkAdapter({
  appId: process.env['MicrosoftAppId'] ?? '',
  appPassword: process.env['MicrosoftAppPassword'] ?? '',
});

adapter.onTurnError = async (context, error) => {
  console.error('[BotFrameworkAdapter] Unhandled error:', error);
  await context.sendActivity('An error occurred. Please try again.');
};

const bot = new AccessConciergeBot();
const app = express();
app.use(express.json());

app.post('/api/messages', (req, res) => {
  adapter.processActivity(req, res, async (context) => {
    await bot.run(context);
  });
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const port = parseInt(process.env['PORT'] ?? '3978', 10);
app.listen(port, '0.0.0.0', () => {
  console.log(`TenantFloe Bot listening on port ${port}`);
});

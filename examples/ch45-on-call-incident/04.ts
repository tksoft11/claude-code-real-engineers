// oncall-bot/src/server.ts
import express from 'express';
import { respondToIncident } from './incidentResponder';

const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ai-oncall-bot' });
});

// Endpoint รับ Webhook จาก PagerDuty / Datadog / Sentry
app.post('/webhooks/pagerduty', async (req, res) => {
  const event = req.body;

  if (event.event?.event_type === 'trigger') {
    const incident = {
      alertName: event.event?.data?.title || 'Unknown Alert',
      service: event.event?.data?.service?.name || 'Unknown Service',
      severity: event.event?.data?.severity || 'critical',
      description: event.event?.data?.custom_details?.description || '',
      timestamp: new Date().toISOString()
    };

    // ตอบ PagerDuty ก่อนภายใน 3 วินาที (timeout requirement)
    res.status(200).json({ status: 'acknowledged' });

    // รัน AI Responder แบบ async (ไม่รอผล)
    respondToIncident(incident).catch(err => {
      console.error('AI Responder error:', err);
    });

  } else {
    res.status(200).json({ status: 'ignored', reason: 'Not a trigger event' });
  }
});

// Endpoint ทดสอบสำหรับ Development
app.post('/test/simulate-incident', async (req, res) => {
  const testIncident = {
    alertName: 'Payment Gateway — 500 Error Rate > 40%',
    service: 'payment-gateway',
    severity: 'critical',
    description: 'Error rate สูงผิดปกติ มีรายงานธุรกรรมล้มเหลวจำนวนมาก',
    timestamp: new Date().toISOString()
  };

  res.json({ status: 'simulation started', incident: testIncident });
  respondToIncident(testIncident).catch(console.error);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🤖 AI On-Call Bot listening on port ${PORT}`));

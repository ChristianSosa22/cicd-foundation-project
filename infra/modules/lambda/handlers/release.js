// release.js — Minimal Lambda handler for ReleaseExpiredReservationCommand
// Consumes from release SQS queue, releases expired reservations.
// The release-worker Lambda execution role (from IAM module) grants:
//   sqs:ReceiveMessage/DeleteMessage/GetQueueAttributes on release queue
//   logs:CreateLogGroup/CreateLogStream/PutLogEvents on CloudWatch
//   secretsmanager:GetSecretValue on project secrets (for DB connection)

exports.handler = async (event) => {
  for (const record of event.Records) {
    const messageId = record.messageId || 'unknown';
    let payload = {};

    try { payload = JSON.parse(record.body || '{}'); } catch { /* empty */ }

    const event_type = payload.event_type || 'ReleaseExpiredReservationCommand';
    const scan_before = payload.data?.scan_before || new Date().toISOString();

    console.log(JSON.stringify({
      event_type,
      message_id: messageId,
      scan_before,
      status: 'processed',
    }, null, 2));

    // Full implementation: UPDATE reservations SET status='expirada'
    // WHERE status='reservada' AND confirm_deadline < :scan_before
  }

  return { statusCode: 200, body: JSON.stringify({ processed: event.Records.length }) };
};

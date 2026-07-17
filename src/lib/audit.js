import { base44 } from '@/api/base44Client';

export async function logAudit(action, entityType, entityId, details = '') {
  try {
    const user = await base44.auth.me().catch(() => null);
    await base44.entities.AuditLog.create({
      user_id: user?.id || '',
      user_name: user?.full_name || 'system',
      action,
      entity_type: entityType || '',
      entity_id: entityId || '',
      details,
    });
  } catch (e) { /* silent */ }
}

export async function logLogin(username, status, failureReason = '') {
  try {
    await base44.entities.LoginLog.create({
      username,
      status,
      failure_reason: failureReason,
      login_time: new Date().toISOString(),
      device: navigator.platform || 'unknown',
      browser: navigator.userAgent?.slice(0, 120) || 'unknown',
    });
  } catch (e) { /* silent */ }
}

export async function createNotification(recipientName, title, message, type = 'info', relatedType = '', relatedId = '') {
  try {
    await base44.entities.Notification.create({
      recipient_name: recipientName,
      title,
      message,
      type,
      related_entity_type: relatedType,
      related_entity_id: relatedId,
      is_read: false,
    });
  } catch (e) { /* silent */ }
}
// Notification helpers — keep notification creation logic out of the
// route handlers so each call site is a one-liner. Functions here are
// fire-and-forget friendly: any thrown error is logged and swallowed
// rather than re-raised, so a notification fan-out failure can never
// break the user action it's reacting to (creating a pin, converting
// a dream, etc.).
//
// Spec: docs/app/spec.md (Section 8: Notifications)
// @implements REQ-NOTIF-001

const db = require('../db');

/**
 * Notify all of `actorUserId`'s accepted friends about an activity
 * the actor just performed. Exactly one notification row per friend.
 *
 * @param {string} actorUserId  - The user who took the action.
 * @param {string} actorName    - Display name to compose displayText with.
 * @param {'friend_memory'|'friend_dream'|'friend_converted'} type
 * @param {string|null} pinId   - The pin the activity is about, or null.
 * @param {string} placeName    - Place name for displayText.
 */
async function notifyFriendsOfActivity(actorUserId, actorName, type, pinId, placeName) {
  try {
    // Fetch all accepted friend ids for the actor. The friendships
    // table stores each pair exactly once with user_id_1 < user_id_2,
    // so we have to UNION both sides.
    const friendsResult = await db.query(
      `SELECT user_id_2 AS friend_id FROM friendships
         WHERE user_id_1 = $1 AND status = 'accepted'
       UNION
       SELECT user_id_1 AS friend_id FROM friendships
         WHERE user_id_2 = $1 AND status = 'accepted'`,
      [actorUserId]
    );

    if (friendsResult.rows.length === 0) return;

    const displayText = composeDisplayText(actorName, type, placeName);

    // Batch insert one row per friend. We could VALUES ($1,$2,...),
    // ($1,$2,...) etc. — but fan-outs are typically <50 friends and
    // doing them in a single multi-row INSERT keeps params clean.
    const values = [];
    const placeholders = [];
    let i = 1;
    for (const row of friendsResult.rows) {
      placeholders.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++})`);
      values.push(row.friend_id, actorUserId, type, pinId, displayText);
    }
    await db.query(
      `INSERT INTO notifications (user_id, actor_id, notification_type, pin_id, display_text)
       VALUES ${placeholders.join(', ')}`,
      values
    );
  } catch (err) {
    // Never let a notification side-effect bubble up to break the
    // user-visible action that triggered it.
    console.error('[notifications] fan-out failed:', err.message);
  }
}

/**
 * Compose the user-facing notification copy. Display text is stored on
 * the row so the rendering side doesn't have to re-derive it from
 * type + place_name (and so historical notifications stay readable
 * even if we change wording in the future).
 */
function composeDisplayText(actorName, type, placeName) {
  const place = placeName || 'somewhere new';
  switch (type) {
    case 'friend_memory':
      return `${actorName} added a memory from ${place}`;
    case 'friend_dream':
      return `${actorName} is dreaming of ${place}`;
    case 'friend_converted':
      return `${actorName} went to ${place} — converted from a dream`;
    default:
      return `${actorName} did something in ${place}`;
  }
}

module.exports = {
  notifyFriendsOfActivity,
};

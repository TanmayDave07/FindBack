# Matching algorithm — Steps 13 and 14

The algorithm compares an active report with active reports of the opposite
type in the same category. It calculates five small scores and adds them.
Only results scoring at least 50 out of 100 become potential matches.

| Function | Rule | Maximum |
| --- | --- | --- |
| `calculateCategoryScore()` | Same category ID | 30 |
| `calculateLocationScore()` | Same location: 25; manually listed nearby location: 15; other location: 0 | 25 |
| `calculateTimeScore()` | Up to 1 hour: 20; 24 hours: 15; 3 days: 10; 7 days: 5; later: 0 | 20 |
| `calculateColorScore()` | Same non-empty color, ignoring case and outer spaces | 10 |
| `calculateDescriptionScore()` | Shared unique keywords divided by all unique keywords, multiplied by 15 | 15 |
| `calculateFinalMatchScore()` | Add the five scores and round to two decimal places | 100 |

Time uses the absolute difference between the two event times. A date without
a time is stored at midnight UTC, as in the reporting API.

Description matching uses lowercase English words and numbers. It ignores
punctuation, repeated words, and common words such as `the`, `and`, and `near`.
For example, `Black leather wallet` and `Black wallet` share two of three
unique keywords, so the description score is `2 / 3 * 15 = 10`.
Private identifying details never participate in matching.

Two black wallets in the same category and location, found 30 minutes apart,
with identical descriptions score `30 + 25 + 20 + 10 + 15 = 100`.
If the second description is only `Black wallet`, the score is 95.
These are starting rules; the weights and cutoff are constants in
`src/services/matchScoring.js` for tuning after tests.

## Nearby campus locations

The `NearbyLocation` table stores manually confirmed pairs of location IDs.
The algorithm checks each pair in both directions, so enter each pair once.
The table starts empty because the project has no verified campus distance map.
Exact-location matching works immediately.

Get IDs from `/api/locations`, then insert a verified pair:

```sql
INSERT INTO "NearbyLocation" ("locationId", "nearbyLocationId")
VALUES ('FIRST_LOCATION_UUID', 'SECOND_LOCATION_UUID')
ON CONFLICT DO NOTHING;
```

After changing nearby pairs or scoring rules, run `npm run matches:rebuild`
to update stored suggestions for existing reports.

-- Keep stale matches for history without showing them as current suggestions.
ALTER TYPE "MatchStatus" ADD VALUE 'INVALIDATED';

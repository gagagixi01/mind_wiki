# Discovery Output Contract

Each candidate must become one DiscoveryRecord JSON object with:
- id
- run_id
- source_pack_id
- discovered_url
- normalized_url
- canonical_url when known
- title
- discovery_method: rss or web_search
- reason_found
- source_type
- trajectory_classification
- duplicate_status
- confidence
- status
- errors
- created_at
- updated_at

Use status `discovered` for usable candidates and `failed` for named discovery failures.

package schema

import "github.com/Universal-SDK/bidon-backend/internal/ad"

type RewardRequest struct {
	ShowRequest
	AdType ad.Type `param:"ad_type" validate:"eq=rewarded"`
}

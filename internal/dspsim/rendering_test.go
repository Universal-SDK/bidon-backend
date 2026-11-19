package dspsim

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/prebid/openrtb/v19/openrtb2"
)

func TestBidCarriesNoRenderingByDefault(t *testing.T) {
	server, sim := newTestServer(t)

	bid := decodeBidResponse(t, postFixture(t, server, "android_adikteev_banner_bidreq.json", "")).SeatBid[0].Bid[0]

	if len(bid.Ext) != 0 {
		t.Errorf("bid.ext = %s, want none", bid.Ext)
	}
	record, _ := sim.Store.Get(bid.ID)
	if record.Rendering != nil {
		t.Errorf("record rendering = %s, want none", record.Rendering)
	}
}

func TestBidCarriesCreativeRendering(t *testing.T) {
	server, sim := newTestServer(t)

	lib, err := LoadLibrary(writeLibrary(t, `{"default": {"static_banner": [{
		"id": "with_rendering", "formats": ["BANNER"], "adm": "<a></a>",
		"rendering": {"close_button": {"position": "top_left"}}
	}]}}`))
	if err != nil {
		t.Fatalf("LoadLibrary: %v", err)
	}
	sim.Bidder.SetLibrary(lib)

	bid := decodeBidResponse(t, postFixture(t, server, "android_adikteev_banner_bidreq.json", "")).SeatBid[0].Bid[0]

	assertRendering(t, bid, `{"close_button":{"position":"top_left"}}`)
}

func TestRenderingOverride(t *testing.T) {
	server, sim := newTestServer(t)

	resp := doRendering(t, server.URL, http.MethodPut, `{ "close_button": { "style": "text_close", "delay_seconds": 2 } }`)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("PUT status = %d, want 200", resp.StatusCode)
	}

	var got struct {
		Override json.RawMessage `json:"override"`
	}
	getJSON(t, server, "/debug/rendering", &got)
	want := `{"close_button":{"style":"text_close","delay_seconds":2}}`
	if string(got.Override) != want {
		t.Errorf("GET override = %s, want %s", got.Override, want)
	}

	bid := decodeBidResponse(t, postFixture(t, server, "android_adikteev_banner_bidreq.json", "")).SeatBid[0].Bid[0]
	assertRendering(t, bid, want)

	record, _ := sim.Store.Get(bid.ID)
	if string(record.Rendering) != want {
		t.Errorf("record rendering = %s, want %s", record.Rendering, want)
	}

	if resp := doRendering(t, server.URL, http.MethodDelete, ""); resp.StatusCode != http.StatusOK {
		t.Fatalf("DELETE status = %d, want 200", resp.StatusCode)
	}
	bid = decodeBidResponse(t, postFixture(t, server, "android_adikteev_banner_bidreq.json", "")).SeatBid[0].Bid[0]
	if len(bid.Ext) != 0 {
		t.Errorf("bid.ext after DELETE = %s, want none", bid.Ext)
	}
}

func TestRenderingOverrideRejectsNonObjects(t *testing.T) {
	server, sim := newTestServer(t)

	for _, body := range []string{"", "null", "[]", `"x"`, "{", `{"a":1} {}`} {
		resp := doRendering(t, server.URL, http.MethodPut, body)
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("PUT %q: status = %d, want 400", body, resp.StatusCode)
		}
	}
	if sim.Bidder.RenderingOverride() != nil {
		t.Errorf("override = %s after rejected PUTs, want none", sim.Bidder.RenderingOverride())
	}
}

func TestPreferredCreativeServesOnlySlotsItFits(t *testing.T) {
	server, _ := newTestServer(t)

	if resp := doDebug(t, server.URL, http.MethodPut, "/debug/creative/adikteev_vast_video", ""); resp.StatusCode != http.StatusOK {
		t.Fatalf("PUT status = %d, want 200", resp.StatusCode)
	}

	for range 5 {
		fullscreen := decodeBidResponse(t, postFixture(t, server, "android_adikteev_rewarded_bidreq.json", "")).SeatBid[0].Bid[0]
		if fullscreen.CrID != "adikteev_vast_video" {
			t.Fatalf("fullscreen creative = %s, want adikteev_vast_video", fullscreen.CrID)
		}
	}

	banner := decodeBidResponse(t, postFixture(t, server, "android_adikteev_banner_bidreq.json", "")).SeatBid[0].Bid[0]
	if banner.CrID == "adikteev_vast_video" {
		t.Error("a banner slot was served the preferred VAST creative")
	}

	if resp := doDebug(t, server.URL, http.MethodDelete, "/debug/creative", ""); resp.StatusCode != http.StatusOK {
		t.Fatalf("DELETE status = %d, want 200", resp.StatusCode)
	}
	var got struct {
		Preferred string `json:"preferred"`
	}
	getJSON(t, server, "/debug/creative", &got)
	if got.Preferred != "" {
		t.Errorf("preferred after DELETE = %q, want none", got.Preferred)
	}
}

func TestPreferredCreativeMustExist(t *testing.T) {
	server, sim := newTestServer(t)

	if resp := doDebug(t, server.URL, http.MethodPut, "/debug/creative/nope", ""); resp.StatusCode != http.StatusNotFound {
		t.Errorf("PUT unknown creative: status = %d, want 404", resp.StatusCode)
	}
	if sim.Bidder.PreferredCreative() != "" {
		t.Errorf("preferred = %q, want none", sim.Bidder.PreferredCreative())
	}
}

// The default VAST creatives play a real video, linked directly: players such
// as ExoPlayer do not follow an http to https redirect.
func TestDefaultVASTPlaysARealVideo(t *testing.T) {
	const want = "<![CDATA[https://storage.googleapis.com/gvabox/media/samples/stock.mp4]]>"

	for _, id := range []string{"default_vast_video", "adikteev_vast_video"} {
		t.Run(id, func(t *testing.T) {
			bidder := NewBidder(testConfig(), loadDefaultLibrary(t))

			response, _, _, err := bidder.Build(bidder.Config.PublicURL, testMatch(t, "android_adikteev_rewarded_bidreq.json"), id)
			if err != nil {
				t.Fatalf("Build(): %v", err)
			}
			if adm := response.SeatBid[0].Bid[0].AdM; !strings.Contains(adm, want) {
				t.Errorf("VAST should carry %s, got %s", want, adm)
			}
		})
	}
}

func assertRendering(t *testing.T, bid openrtb2.Bid, want string) {
	t.Helper()

	var ext struct {
		Rendering json.RawMessage `json:"rendering"`
	}
	if err := json.Unmarshal(bid.Ext, &ext); err != nil {
		t.Fatalf("decode bid.ext %s: %v", bid.Ext, err)
	}
	if string(ext.Rendering) != want {
		t.Errorf("bid.ext.rendering = %s, want %s", ext.Rendering, want)
	}
}

func doRendering(t *testing.T, base, method, body string) *http.Response {
	t.Helper()
	return doDebug(t, base, method, "/debug/rendering", body)
}

func doDebug(t *testing.T, base, method, path, body string) *http.Response {
	t.Helper()

	req, err := http.NewRequest(method, base+path, strings.NewReader(body))
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("%s %s: %v", method, path, err)
	}
	_, _ = io.Copy(io.Discard, resp.Body)
	_ = resp.Body.Close()
	return resp
}

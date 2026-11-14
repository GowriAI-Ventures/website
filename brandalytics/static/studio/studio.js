const $ = (id) => document.getElementById(id);
const basePath = document.body.dataset.basePath || "";
const creator = document.body.dataset.creator === "true";
const liveConfigured = document.body.dataset.live === "true";

function element(tag, content, className) {
  const node = document.createElement(tag);
  if (content !== undefined) node.textContent = content;
  if (className) node.className = className;
  return node;
}

function link(title, url, className) {
  const node = element("a", title, className);
  node.href = url;
  node.target = "_blank";
  node.rel = "noopener noreferrer";
  return node;
}

function clipCaption(value, limit) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  const prefix = text.slice(0, limit - 1);
  const boundary = prefix.lastIndexOf(" ");
  return (boundary > limit * .75 ? prefix.slice(0, boundary) : prefix) + "…";
}

function creatorDraftLink(row, query) {
  const draft = new URLSearchParams({
    title: clipCaption(row.title, 100),
    hook: clipCaption(row.title, 170),
    context: clipCaption(row.snippet, 210),
    source: row.url,
    query: clipCaption(query, 160),
  });
  const action = element("a", "Create a short ↗", "quiet-button source-action");
  action.href = basePath + "/studio/creator#" + draft.toString();
  return action;
}

function feedback(id, message, error = false) {
  const container = $(id);
  container.dataset.error = error;
  container.textContent = message;
}

async function request(url, payload) {
  const response = await fetch(url, payload === undefined ? undefined : {
    method: "POST",
    headers: payload instanceof FormData ? undefined : {"Content-Type": "application/json"},
    body: payload instanceof FormData ? payload : JSON.stringify(payload),
  });
  if (response.ok) return response;
  const body = await response.json().catch(() => ({}));
  const detail = body.detail;
  const error = new Error(typeof detail === "string" ? detail :
    Array.isArray(detail) ? (detail[0]?.msg || "Check the form fields.") : "The request failed.");
  error.status = response.status;
  throw error;
}

function formError(id, error) {
  if (error.status === 401) {
    feedback(id, "To use this feature, ", true);
    const signIn = element("a", "sign in");
    signIn.href = `/auth/login?next=${encodeURIComponent(location.pathname)}`;
    const signUp = element("a", "create an account");
    signUp.href = `/auth/signup?next=${encodeURIComponent(location.pathname)}`;
    $(id).append(signIn, " or ", signUp, ".");
    return;
  }
  feedback(id, error.message, true);
}

function action(form, handler) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.submitter || form.querySelector("button[type=submit]");
    if (!button) return;
    button.disabled = true;
    try {
      await handler(Object.fromEntries(new FormData(form)));
    } finally {
      button.disabled = false;
    }
  });
}

function requestTracker() {
  let last, id;
  return {
    forPayload(payload) {
      const key = JSON.stringify(payload);
      if (key !== last) id = crypto.randomUUID();
      last = key;
      return {...payload, request_id: id};
    },
    clear() { last = undefined; },
  };
}

function showReceipt(id, receipt) {
  const details = $(id);
  details.hidden = !receipt;
  if (receipt) {
    details.querySelector("p").textContent = [
      receipt.provider,
      `$${(receipt.cost_micro / 1000000).toFixed(6)}`,
      receipt.call_id && `Call ${receipt.call_id}`,
      new Date(receipt.collected_at).toLocaleString(),
      receipt.incomplete && "Partial provider coverage",
    ].filter(Boolean).join(" · ");
  }
}

const example = {
  input: {
    brand: "HOKA", peers: ["Brooks", "ASICS", "Nike"],
    query: "What are the best running shoes for new runners?", country: "us",
  },
  organic: [
    {rank: 1, title: "Best Running Shoes for Beginners", domain: "runrepeat.com",
      url: "https://runrepeat.com/guides/best-for-beginners-running-shoes", brands: ["HOKA", "Brooks", "ASICS"]},
    {rank: 2, title: "Best running shoes for beginners", domain: "womensrunning.co.uk",
      url: "https://www.womensrunning.co.uk/gear/shoes/best-running-shoes-for-beginners/", brands: ["HOKA", "Brooks"]},
    {rank: 3, title: "The best running shoes for beginners", domain: "running-point.com",
      url: "https://www.running-point.com/blog/buying-guide/the-best-running-shoes-for-beginners.html", brands: ["ASICS", "Nike"]},
    {rank: 4, title: "Best Marathon Running Shoes", domain: "runrepeat.com",
      url: "https://runrepeat.com/guides/best-marathon-running-shoes", brands: ["ASICS"]},
  ],
  overview: {
    text: "A cushioned daily trainer is a common starting point for new runners. Example models include the ASICS Gel-Cumulus, HOKA Clifton and Brooks Ghost. Fit, comfort and intended use can guide the choice.",
    brands: ["HOKA", "Brooks", "ASICS"],
    sources: [
      {title: "RunRepeat ↗", url: "https://runrepeat.com/guides/best-for-beginners-running-shoes"},
      {title: "Women’s Running ↗", url: "https://www.womensrunning.co.uk/gear/shoes/best-running-shoes-for-beginners/"},
    ],
  },
};
example.metrics = [example.input.brand, ...example.input.peers].map((name) => ({
  name, mentions: example.organic.filter((row) => row.brands.includes(name)).length,
  in_overview: example.overview.brands.includes(name),
}));

function initMarket() {
  let history = [];
  let current = example;
  const form = $("scan-form");
  const tracker = requestTracker();

  function populateForm(input) {
    for (const key of ["brand", "country", "query"]) form.elements[key].value = input[key];
    form.elements.peers.value = input.peers.join(", ");
  }

  function evidence() {
    const filter = $("brand-filter").value;
    const rows = current.organic.filter((row) => !filter || row.brands.includes(filter));
    $("evidence").replaceChildren(...rows.map((row) => {
      const entry = element("div", undefined, "source-row");
      const content = element("div");
      const chips = element("div", undefined, "chips");
      row.brands.forEach((brand) => chips.append(element("span", brand, "chip")));
      content.append(link(row.title + " ↗", row.url, "source-title"),
        element("p", row.domain, "source-domain"));
      if (row.snippet) content.append(element("p", row.snippet, "source-snippet"));
      if (chips.childNodes.length) content.append(chips);
      if (current.id || current.captured_at) content.append(creatorDraftLink(row, current.input.query));
      entry.append(element("span", "#" + row.rank, "rank"), content);
      return entry;
    }));
    if (!rows.length) $("evidence").append(element("p", "No results for this view.", "empty"));
  }

  function report(data) {
    current = data;
    const count = data.organic.length;
    const selectedIndex = history.findIndex((scan) => scan.id === data.id);
    const previous = selectedIndex >= 0 && history.slice(selectedIndex + 1)
      .find((scan) => JSON.stringify(scan.input) === JSON.stringify(data.input) && scan.organic.length === count);
    $("result-mode").textContent = data.id ? "SAVED LIVE SCAN" : data.captured_at ? `PUBLIC SNAPSHOT · ${new Date(data.captured_at).toLocaleDateString()}` : "ILLUSTRATIVE DATA";
    $("metrics").replaceChildren();
    $("bars").replaceChildren();
    for (const [i, metric] of data.metrics.entries()) {
      const card = element("article", undefined, "panel metric");
      const amount = element("div", String(metric.mentions), "metric-value");
      amount.append(element("small", ` / ${count}`));
      const note = data.overview.text ?
        (metric.in_overview ? "Mentioned in AI Overview" : "No AI Overview mention") : "AI Overview unavailable";
      const change = previous ? metric.mentions - previous.metrics[i].mentions : null;
      const delta = change === null ? "" : ` · ${change > 0 ? "+" : ""}${change} vs prior`;
      card.append(element("div", metric.name, "metric-label"), amount, element("p", note + delta, "metric-note"));
      $("metrics").append(card);

      const bar = element("div", undefined, "bar-row");
      const label = element("span", metric.name);
      label.title = metric.name;
      const track = element("div", undefined, "bar-track");
      const fill = element("div", undefined, "bar-fill");
      fill.style.width = count ? `${metric.mentions / count * 100}%` : "0%";
      track.append(fill);
      bar.append(label, track, element("span", String(metric.mentions)));
      $("bars").append(bar);
    }
    $("comparison").textContent = previous ?
      "Compared with the previous scan of this query, market and brands at equal result depth." :
      `${count} organic results sampled. Matching uses exact brand names.`;
    const overview = $("overview");
    overview.replaceChildren();
    if (data.overview.text) {
      overview.append(element("p", data.overview.text, "overview-text"));
      const sources = element("div", undefined, "chips");
      for (const source of data.overview.sources) sources.append(link(source.title, source.url, "chip"));
      overview.append(sources);
    } else {
      overview.append(element("p", "An AI Overview was unavailable for this query and market.", "empty"));
    }
    $("brand-filter").replaceChildren(new Option("All results", ""), ...data.metrics.map(({name}) => new Option(name, name)));
    evidence();
    showReceipt("scan-receipt", data.receipt);
  }

  function setHistory(selected = "") {
    $("history-wrap").hidden = history.length === 0;
    $("history").replaceChildren(new Option("Load a saved scan", ""), ...history.map((scan) =>
      new Option(`${scan.input.brand} · ${new Date(scan.receipt.collected_at).toLocaleString()}`, scan.id)));
    $("history").value = selected;
  }

  report(example);
  $("brand-filter").addEventListener("change", evidence);
  const samples = new Map([["illustrative", example]]);
  const requestedSample = new URLSearchParams(location.search).get("sample");
  const sampleSelect = $("sample-scan");
  fetch(basePath + "/static/studio/showcase/radar.json").then((response) => {
    if (!response.ok) throw new Error("Sample scans unavailable");
    return response.json();
  }).then((reports) => {
    for (const report of reports) {
      samples.set(report.input.brand, report);
      sampleSelect.add(new Option(`${report.input.brand} · captured scan`, report.input.brand));
    }
    if (requestedSample && samples.has(requestedSample) && !sampleSelect.value && current === example) {
      sampleSelect.value = requestedSample;
      sampleSelect.dispatchEvent(new Event("change"));
    }
  }).catch(() => {});
  sampleSelect.addEventListener("change", () => {
    const sample = samples.get(sampleSelect.value);
    if (!sample) return;
    populateForm(sample.input);
    setHistory();
    report(sample);
    feedback("scan-feedback", "");
  });
  $("history").addEventListener("change", () => {
    const selected = history.find((scan) => scan.id === $("history").value);
    if (selected) {
      sampleSelect.value = "";
      populateForm(selected.input);
      report(selected);
      feedback("scan-feedback", "");
    }
  });
  action(form, async (data) => {
    if (!liveConfigured) return feedback("scan-feedback", "Set TREG_TOKEN on the server to run live scans.", true);
    const payload = {
      brand: data.brand.trim(), peers: data.peers.split(",").map((peer) => peer.trim()).filter(Boolean),
      country: data.country, query: data.query.trim(),
    };
    feedback("scan-feedback", "Collecting Google results and AI Overview citations…");
    try {
      const scan = await (await request("/api/studio/scans", tracker.forPayload(payload))).json();
      tracker.clear();
      history = [scan, ...history.filter((item) => item.id !== scan.id)].slice(0, 30);
      sampleSelect.value = "";
      setHistory(scan.id);
      report(scan);
      feedback("scan-feedback", scan.organic.length ? "Scan saved." : "Scan saved. Treg returned no usable organic results.");
    } catch (error) {
      if (error.status && error.status !== 409 && error.status !== 504) tracker.clear();
      formError("scan-feedback", error);
    }
  });
  return async () => {
    history = await (await request("/api/studio/scans")).json();
    if (history.length && !requestedSample) {
      const latest = history[0];
      setHistory(latest.id);
      populateForm(latest.input);
      report(latest);
    } else if (history.length) {
      setHistory();
    }
  };
}

function captionFiles(data, header) {
  const ends = header?.split(",").map(Number);
  if (!ends || ends.length !== 3 || ends.some((end, i) =>
    !Number.isInteger(end) || end <= (ends[i - 1] || 0))) return null;

  function stamp(ms) {
    const date = new Date(ms).toISOString();
    return date.slice(11, 23);
  }
  const cues = ["hook", "context", "takeaway"].map((field, i) => {
    const start = stamp(ends[i - 1] || 0);
    const end = stamp(ends[i]);
    const text = data[field].trim().replace(/\s+/g, " ");
    return {i: i + 1, start, end, text};
  });
  const srt = cues.map(({i, start, end, text}) =>
    `${i}\n${start.replace(".", ",")} --> ${end.replace(".", ",")}\n${text}\n`).join("\n");
  const vtt = "WEBVTT\n\n" + cues.map(({start, end, text}) =>
    `${start} --> ${end}\n${text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}\n`).join("\n");
  return {srt, vtt};
}

function initCreator() {
  const trendForm = $("trend-form");
  const videoForm = $("video-form");
  const tracker = requestTracker();
  let videoUrl;
  let captionsUrl;
  let trackUrl;
  let footageUrl;
  const footageInput = $("footage");
  const footagePreview = $("footage-preview");
  let scene = "hook";
  const sceneButtons = [...document.querySelectorAll("[data-preview]")];

  function preview() {
    $("video-preview").className = `video-preview ${videoForm.elements.style.value} ${videoForm.elements.treatment.value}`;
    $("video-preview").dataset.background = footageUrl ? "footage" : videoForm.elements.background.value;
    footagePreview.hidden = !footageUrl || !$("movie").hidden;
    $("preview-caption").textContent = videoForm.elements[scene].value || "Add a caption";
    for (const button of sceneButtons) {
      const active = button.dataset.preview === scene && $("movie").hidden;
      button.setAttribute("aria-pressed", String(active));
      if (active) $("preview-label").textContent = button.textContent;
    }
  }

  function showStoryboard() {
    $("movie").pause();
    $("movie").hidden = true;
    $("video-placeholder").hidden = false;
    preview();
  }

  function clearCaptions() {
    if (captionsUrl) URL.revokeObjectURL(captionsUrl);
    if (trackUrl) URL.revokeObjectURL(trackUrl);
    captionsUrl = undefined;
    trackUrl = undefined;
    $("movie").querySelector("track")?.remove();
    $("download-captions").hidden = true;
  }

  function invalidateVideo() {
    clearCaptions();
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    videoUrl = undefined;
    $("movie").removeAttribute("src");
    $("movie").load();
    $("download-video").hidden = true;
    feedback("render-feedback", "");
    showStoryboard();
  }

  footageInput.addEventListener("change", () => {
    if (footageUrl) URL.revokeObjectURL(footageUrl);
    footageUrl = undefined;
    footagePreview.removeAttribute("src");
    footagePreview.load();
    const clip = footageInput.files[0];
    if (clip && clip.size <= 20 * 1024 * 1024) {
      footageUrl = URL.createObjectURL(clip);
      footagePreview.src = footageUrl;
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
        footagePreview.play().catch(() => {});
      }
    }
    invalidateVideo();
    if (clip && !footageUrl) feedback("render-feedback", "Choose a video up to 20 MB.", true);
  });

  let draftSource = "";
  let suggestion;
  function clearDraftReview() {
    if (!$("draft-review")) return;
    suggestion = undefined;
    $("draft-review").hidden = true;
    feedback("draft-feedback", "");
  }

  if ($("assist-draft")) {
    const fields = ["hook", "context", "takeaway"];
    const writingInput = () => ({
      topic: videoForm.elements.title.value.trim(),
      notes: [draftSource, ...fields.map((field) => videoForm.elements[field].value)].filter(Boolean).join("\n"),
    });
    $("assist-draft").addEventListener("click", async () => {
      const button = $("assist-draft");
      clearDraftReview();
      const input = writingInput();
      button.disabled = true;
      feedback("draft-feedback", "Writing a three-scene draft on Spark…");
      try {
        const result = await (await request("/api/studio/drafts", input)).json();
        if (JSON.stringify(input) !== JSON.stringify(writingInput())) {
          feedback("draft-feedback", "Storyboard changed while writing. Request a new draft.");
          return;
        }
        suggestion = result.copy;
        for (const field of fields) $(`suggested-${field}`).textContent = suggestion[field];
        $("draft-review").hidden = false;
        feedback("draft-feedback", `Review before applying · ${result.input_tokens} input + ${result.output_tokens} output tokens`);
      } catch (error) {
        formError("draft-feedback", error);
      } finally {
        button.disabled = false;
      }
    });
    $("apply-draft").addEventListener("click", () => {
      if (!suggestion) return;
      for (const field of fields) videoForm.elements[field].value = suggestion[field];
      clearDraftReview();
      invalidateVideo();
    });
    videoForm.addEventListener("input", ({target}) => {
      if (fields.includes(target.name) || target.name === "title") clearDraftReview();
    });
  }

  function populateDraft(title, hook, context, url, sourceLabel, query) {
    draftSource = [title, context, query].filter(Boolean).join(" · ").slice(0, 265);
    clearDraftReview();
    videoForm.elements.title.value = clipCaption(title, 100);
    videoForm.elements.hook.value = clipCaption(hook, 170);
    videoForm.elements.context.value = clipCaption(context, 210);
    videoForm.elements.takeaway.value = "";
    videoForm.elements.takeaway.placeholder = "Write the insight you want viewers to leave with.";
    const source = $("topic-source");
    source.replaceChildren(link(sourceLabel, url, "chip"));
    if (query) source.append(element("p", "Discovery query · " + query, "source-snippet"));
    source.hidden = false;
    scene = "hook";
    invalidateVideo();
    videoForm.elements.hook.focus();
  }

  function useTopic(topic) {
    const context = topic.rank
      ? `This hashtag ranked #${topic.rank} in the selected TikTok market and category over 7 days.`
      : `This Reddit discussion drew ${topic.comments} comments. Here’s what people are talking about.`;
    populateDraft(topic.title, topic.title, context, topic.url, "Storyboard source ↗");
  }

  function loadMarketDraft() {
    const params = new URLSearchParams(location.hash.slice(1));
    if (!params.has("title")) return;
    let source;
    try {
      source = new URL(params.get("source"));
    } catch {
      return;
    }
    if (!["http:", "https:"].includes(source.protocol) || source.username || source.password) return;
    populateDraft(params.get("title"), params.get("hook"), params.get("context"),
      source.href, `Source · ${source.hostname} ↗`, clipCaption(params.get("query"), 160));
  }

  loadMarketDraft();

  preview();
  sceneButtons.forEach((button) => button.addEventListener("click", () => {
    scene = button.dataset.preview;
    showStoryboard();
  }));
  videoForm.addEventListener("input", ({target}) => {
    if (sceneButtons.some((button) => button.dataset.preview === target.name)) scene = target.name;
    invalidateVideo();
  });
  function toggleSource() {
    const reddit = trendForm.elements.source.value === "reddit";
    $("reddit-fields").hidden = !reddit;
    trendForm.elements.subreddit.disabled = !reddit;
    $("tiktok-fields").hidden = reddit;
  }
  toggleSource();
  trendForm.elements.source.addEventListener("change", toggleSource);
  action(trendForm, async ({source, subreddit, region, category}) => {
    if (!liveConfigured) return feedback("trend-feedback", "Set TREG_TOKEN on the server to find live topics.", true);
    const reddit = source === "reddit";
    const endpoint = reddit ? "trends" : "hashtags";
    const payload = reddit ? {subreddit} : {region, category};
    feedback("trend-feedback", reddit ? "Finding active discussions…" : "Loading TikTok hashtag rankings…");
    try {
      const data = await (await request(`/api/studio/${endpoint}`, tracker.forPayload(payload))).json();
      tracker.clear();
      $("topics").replaceChildren();
      for (const topic of data.topics) {
        const item = element("article", undefined, "topic");
        const button = element("button", "Use in storyboard ↗", "quiet-button");
        button.type = "button";
        button.addEventListener("click", () => useTopic(topic));
        const metrics = reddit ? `${topic.comments} comments · ${topic.votes} score` :
          `#${topic.rank} · ${topic.posts.toLocaleString()} posts · ${topic.views.toLocaleString()} views`;
        item.append(link(topic.title, topic.url, "source-title"), element("p", metrics, "source-domain"));
        if (topic.popularity?.length) {
          const spark = element("div", undefined, "spark");
          spark.setAttribute("role", "img");
          spark.setAttribute("aria-label", `Daily relative popularity, oldest first: ${topic.popularity.map(Math.round).join(", ")}`);
          topic.popularity.forEach((value) => {
            const bar = element("span");
            bar.style.height = `${Math.max(4, value)}%`;
            spark.append(bar);
          });
          item.append(spark);
        }
        if (topic.excerpt) item.append(element("p", topic.excerpt, "source-snippet"));
        item.append(button);
        $("topics").append(item);
      }
      showReceipt("trend-receipt", data.receipt);
      const label = reddit ? `r/${subreddit}` : `TikTok · ${region} · last 7 days`;
      feedback("trend-feedback", data.topics.length ? `${data.topics.length} topics from ${label}` : "No eligible topics returned.");
    } catch (error) {
      if (error.status && error.status !== 409 && error.status !== 504) tracker.clear();
      formError("trend-feedback", error);
    }
  });

  action(videoForm, async (data) => {
    const voices = {chatterbox: "Chatterbox", kokoro: "Kokoro", system: "System voice", none: "No voiceover"};
    const selectedVoice = data.narration === "on" ? voices[data.voice] : voices.none;
    feedback("render-feedback", `Rendering three scenes · ${selectedVoice}…`);
    const currentDraft = () => JSON.stringify(Object.fromEntries(new FormData(videoForm)));
    const submitted = JSON.stringify(data);
    try {
      const draft = {...data, narration: data.narration === "on"};
      const clip = footageInput.files[0];
      let response;
      if (clip) {
        if (clip.size > 20 * 1024 * 1024) throw new Error("Choose a video up to 20 MB.");
        const upload = new FormData();
        upload.set("draft", JSON.stringify(draft));
        upload.set("footage", clip);
        response = await request("/api/studio/video/footage", upload);
      } else {
        response = await request("/api/studio/video", draft);
      }
      const blob = await response.blob();
      if (submitted !== currentDraft() || clip !== footageInput.files[0]) {
        feedback("render-feedback", "Storyboard changed during rendering. Render the updated draft to preview it.");
        return;
      }
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      videoUrl = URL.createObjectURL(blob);
      const movie = $("movie");
      clearCaptions();
      movie.src = videoUrl;
      const captions = captionFiles(data, response.headers.get("X-Caption-Timing"));
      if (captions) {
        trackUrl = URL.createObjectURL(new Blob([captions.vtt], {type: "text/vtt"}));
        captionsUrl = URL.createObjectURL(new Blob([captions.srt], {type: "application/x-subrip"}));
        const track = element("track");
        track.kind = "captions";
        track.label = "Storyboard captions";
        track.src = trackUrl;
        // Some browsers already expose the embedded MP4 track.
        movie.addEventListener("loadedmetadata", () => {
          if (!movie.textTracks.length) movie.append(track);
        }, {once: true});
        $("download-captions").href = captionsUrl;
        $("download-captions").hidden = false;
      }
      movie.hidden = false;
      $("video-placeholder").hidden = true;
      $("download-video").href = videoUrl;
      $("download-video").hidden = false;
      preview();
      const encoder = response.headers.get("X-Video-Encoder");
      const label = {h264_nvenc: "NVIDIA NVENC", h264_videotoolbox: "Apple VideoToolbox", libx264: "CPU"}[encoder] || "H.264";
      feedback("render-feedback", `Short ready · ${voices[response.headers.get("X-Video-Voice")]} · ${label}`);
    } catch (error) {
      formError("render-feedback", error);
    }
  });
}

function drawHero() {
  const canvas = $("hero-art");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  new ResizeObserver(() => {
    const {width, height} = canvas.getBoundingClientRect();
    const ratio = Math.min(2, devicePixelRatio);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.scale(ratio, ratio);
    const x = width * (width < 520 ? 1.05 : .78);
    const y = height * .6;
    const radius = Math.min(238, width * .3);
    const rainbow = creator ? [222, 251, 153] : [187, 165, 255];
    const shade = (opacity) => `rgba(${rainbow.join(",")},${opacity})`;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-.25);
    ctx.scale(1, .60);
    for (let i = 1; i < 11; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, radius * i / 10, 0, Math.PI * 2);
      ctx.strokeStyle = shade(.12 + (i % 3 === 0 ? .14 : 0));
      ctx.stroke();
    }
    for (let i = 0; i < 24; i++) {
      const theta = i * Math.PI / 12;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(theta) * radius, Math.sin(theta) * radius);
      ctx.strokeStyle = shade(.11);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, 4.7, 5.48);
    ctx.closePath();
    ctx.fillStyle = shade(.14);
    ctx.fill();
    for (const [angle, distance] of [[-1.07,.8],[-.6,.59],[2.1,.69],[.3,.87],[3.25,.49],[-2.6,.82]]) {
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * radius * distance, Math.sin(angle) * radius * distance, 4, 0, Math.PI * 2);
      ctx.shadowColor = "#dafb92";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#dafb92";
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = shade(.12);
    for (let a = width * .52; a < width; a += 15) {
      for (let b = 14; b < height; b += 15) ctx.fillRect(a, b, 1.2, 1.2);
    }
  }).observe(canvas);
}

const loadHistory = creator ? initCreator() : initMarket();
drawHero();
if (document.body.dataset.previewOnly !== "true") {
  const next = encodeURIComponent(location.pathname);
  $("account").href = `/auth/login?next=${next}`;
  $("top-account").href = `/auth/signup?next=${next}`;
  $("projects-link").addEventListener("click", (event) => {
    if ($("account").pathname === "/auth/login") {
      event.preventDefault();
      location.href = "/auth/login";
    }
  });
  try {
    const user = await (await request("/api/studio/session")).json();
    if (user.name) {
      $("account-name").textContent = user.name;
      $("account").href = "/settings";
      $("account").querySelector(".avatar").textContent = user.name[0].toUpperCase();
      $("top-account").textContent = "Projects ↗";
      $("top-account").href = "/dashboard";
      if (loadHistory) await loadHistory();
    }
  } catch (error) {
    if (error.status !== 401 && loadHistory) feedback("scan-feedback", "Saved scans could not be loaded.", true);
  }
}

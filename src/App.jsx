import { useState, useRef } from "react";
import "./App.css";

const GENRE_OPTIONS = ["Fantasy", "Science Fiction", "Horror", "Mystery", "Romance", "Historical", "Thriller", "Mythology", "Post-Apocalyptic", "Fairy Tale"];
const TONE_OPTIONS  = ["Epic & Heroic", "Dark & Gritty", "Whimsical & Light", "Tense & Suspenseful", "Melancholic & Poetic", "Humorous & Satirical", "Romantic & Lyrical", "Cold & Cerebral"];
const SCOPE_OPTIONS = ["A single fateful night", "A short journey (days)", "A grand quest (weeks)", "An epic saga (years)", "A single conversation"];

const STARS = Array.from({ length: 80 }, (_, i) => ({
  id: i,
  top: Math.random() * 100,
  left: Math.random() * 100,
  dur: 2 + Math.random() * 4,
  delay: -Math.random() * 4,
  size: Math.random() > 0.8 ? 3 : 2,
}));

function parseStoryResponse(raw) {
  const clean = (raw || "").replace(/```json|```/g, "").trim();
  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try { return JSON.parse(jsonMatch[0]); } catch { return null; }
}

async function callClaude(messages, systemPrompt) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "API error");
  return data.content?.map(b => b.text || "").join("") || "";
}

export default function App() {
  const [screen, setScreen]           = useState("setup");
  const [config, setConfig]           = useState({ genre: "", theme: "", tone: "", scope: "", extra: "" });
  const [storyOptions, setStoryOptions] = useState([]);
  const [storyTitle, setStoryTitle]   = useState("");
  const [chapter, setChapter]         = useState(0);
  const [history, setHistory]         = useState([]);
  const [current, setCurrent]         = useState(null);
  const [displayedText, setDisplayedText] = useState("");
  const [typing, setTyping]           = useState(false);
  const [loadingMsg, setLoadingMsg]   = useState("Weaving your tale…");
  const [error, setError]             = useState("");
  const typingRef = useRef(null);

  const update = (k, v) => setConfig(c => ({ ...c, [k]: v }));
  const canBegin = config.genre && config.tone && config.scope;

  const typeText = (text, onDone) => {
    setTyping(true);
    setDisplayedText("");
    let i = 0;
    const speed = Math.max(8, Math.min(22, Math.floor(2400 / text.length)));
    typingRef.current = setInterval(() => {
      i++;
      setDisplayedText(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(typingRef.current);
        setTyping(false);
        onDone?.();
      }
    }, speed);
  };

  const skipTyping = () => {
    if (typing && current) {
      clearInterval(typingRef.current);
      setTyping(false);
      setDisplayedText(current.passage);
    }
  };

  const buildPickerSystem = () =>
    `You are a master storyteller. Based on the story parameters, generate exactly 3 distinct story concepts.
You MUST respond ONLY with valid JSON — no preamble, no markdown fences, no explanation.
Return exactly this shape:
{
  "stories": [
    { "title": "Evocative title (2-6 words)", "synopsis": "A compelling 2-3 sentence synopsis hinting at the premise, protagonist, and central conflict." },
    { "title": "...", "synopsis": "..." },
    { "title": "...", "synopsis": "..." }
  ]
}
Story parameters: Genre=${config.genre}, Theme="${config.theme || "open"}", Tone=${config.tone}, Scope=${config.scope}.${config.extra ? ` Extra context: ${config.extra}` : ""}
Make each concept feel meaningfully different — vary settings, protagonists, or central conflicts. Each should feel exciting and distinct.`;

  const buildOpeningSystem = (concept) =>
    `You are a master storyteller crafting an immersive, literary choose-your-own-adventure story.
You MUST respond ONLY with valid JSON — no preamble, no markdown fences, no explanation.
Return exactly this shape:
{
  "title": "Story title (evocative, 2-5 words)",
  "passage": "The narrative passage (200-280 words, richly descriptive, second-person 'you'). Use \\n\\n for paragraph breaks.",
  "choices": ["Choice A (10-20 words)", "Choice B (10-20 words)", "Choice C (10-20 words)"],
  "isEnding": false
}
Story parameters: Genre=${config.genre}, Theme="${config.theme || "open"}", Tone=${config.tone}, Scope=${config.scope}.${config.extra ? ` Extra context: ${config.extra}` : ""}${concept ? `\nChosen story concept — Title: "${concept.title}". Synopsis: "${concept.synopsis}". Build the opening passage faithfully from this concept.` : ""}
Write with literary quality. Vary sentence rhythm. Be specific and sensory. Make choices feel genuinely consequential.`;

  const buildContinueSystem = () =>
    `You are continuing an immersive choose-your-own-adventure story.
Genre=${config.genre}, Tone=${config.tone}, Scope=${config.scope}.
Respond ONLY with valid JSON:
{
  "passage": "Next narrative passage (200-280 words, second-person 'you', sensory and specific). \\n\\n for paragraph breaks.",
  "choices": ["Choice A (10-20 words)", "Choice B (10-20 words)", "Choice C (10-20 words)"],
  "isEnding": false
}
If this feels like a natural story ending (after ~5-8 choices, or if the narrative naturally concludes), set isEnding: true and omit choices. Write an emotionally resonant closing passage (150-200 words).
Maintain narrative consistency. Raise stakes. Honor the player's choice.`;

  const generateOptions = async () => {
    setError("");
    setScreen("loading");
    const msgs = ["Summoning story concepts…", "Consulting the ancient tomes…", "Three paths diverge before you…", "The ink stirs with possibility…"];
    let mi = 0;
    setLoadingMsg(msgs[mi]);
    const interval = setInterval(() => { mi = (mi + 1) % msgs.length; setLoadingMsg(msgs[mi]); }, 1800);

    try {
      const raw = await callClaude(
        [{ role: "user", content: "Generate 3 distinct story concepts based on the parameters." }],
        buildPickerSystem()
      );
      clearInterval(interval);
      const parsed = parseStoryResponse(raw);
      if (!parsed?.stories?.length) throw new Error("Could not generate story options.");
      setStoryOptions(parsed.stories);
      setScreen("picker");
    } catch (e) {
      clearInterval(interval);
      setError(e.message || "Something went wrong. Please try again.");
      setScreen("setup");
    }
  };

  const startChosenStory = async (concept) => {
    setError("");
    setScreen("loading");
    const msgs = ["Consulting the ancient tomes…", "Weaving the threads of fate…", "The ink begins to flow…", "Your story stirs to life…"];
    let mi = 0;
    setLoadingMsg(msgs[mi]);
    const interval = setInterval(() => { mi = (mi + 1) % msgs.length; setLoadingMsg(msgs[mi]); }, 1800);

    try {
      const raw = await callClaude(
        [{ role: "user", content: "Begin the story. Write the opening passage." }],
        buildOpeningSystem(concept)
      );
      clearInterval(interval);
      const parsed = parseStoryResponse(raw);
      if (!parsed) throw new Error("Could not parse story response.");
      setStoryTitle(parsed.title || concept.title || "Your Story");
      setCurrent(parsed);
      setChapter(1);
      setHistory([]);
      setScreen("story");
      typeText(parsed.passage);
    } catch (e) {
      clearInterval(interval);
      setError(e.message || "Something went wrong. Please try again.");
      setScreen("picker");
    }
  };

  const makeChoice = async (choice, idx) => {
    if (typing) { skipTyping(); return; }
    setError("");

    const newHistory = [...history, { passage: current.passage, choice }];
    setHistory(newHistory);
    setScreen("loading");
    setLoadingMsg(["The story unfolds…", "Destiny shifts…", "A new path opens…"][idx % 3]);

    const contextContent = `Story title: "${storyTitle}"\n\nFull story so far:\n\n${newHistory.map((h, i) => `[Chapter ${i + 1}]\n${h.passage}\n\n[Player chose: ${h.choice}]`).join("\n\n")}`;

    try {
      const raw = await callClaude(
        [
          { role: "user", content: contextContent },
          { role: "user", content: `Continue the story after the player's choice: "${choice}"` },
        ],
        buildContinueSystem()
      );
      const parsed = parseStoryResponse(raw);
      if (!parsed) throw new Error("Could not parse story response.");
      setCurrent(parsed);
      setChapter(c => c + 1);
      setScreen(parsed.isEnding ? "ending" : "story");
      typeText(parsed.passage);
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
      setScreen("story");
    }
  };

  const restart = () => {
    clearInterval(typingRef.current);
    setScreen("setup");
    setConfig({ genre: "", theme: "", tone: "", scope: "", extra: "" });
    setHistory([]);
    setCurrent(null);
    setDisplayedText("");
    setChapter(0);
    setStoryTitle("");
    setStoryOptions([]);
    setError("");
  };

  return (
    <div className="app">
      {/* Starfield */}
      <div className="stars" aria-hidden="true">
        {STARS.map(s => (
          <div
            key={s.id}
            className="star"
            style={{ top: `${s.top}%`, left: `${s.left}%`, width: s.size, height: s.size, "--dur": `${s.dur}s`, "--delay": `${s.delay}s` }}
          />
        ))}
      </div>

      <div className="content">

        {/* ── SETUP ── */}
        {screen === "setup" && (
          <div className="title-screen">
            <div className="title-ornament">✦ ✦ ✦</div>
            <h1 className="title-main">Scribe</h1>
            <p className="title-sub">AI-Powered Adventure</p>

            {error && <div className="error-banner">{error}</div>}

            <div className="grimoire">
              <div className="section-label">Craft Your Story</div>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="genre">Genre</label>
                  <select id="genre" className="field-select" value={config.genre} onChange={e => update("genre", e.target.value)}>
                    <option value="">Choose genre…</option>
                    {GENRE_OPTIONS.map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="tone">Tone</label>
                  <select id="tone" className="field-select" value={config.tone} onChange={e => update("tone", e.target.value)}>
                    <option value="">Choose tone…</option>
                    {TONE_OPTIONS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-field full">
                  <label htmlFor="scope">Story Scope</label>
                  <select id="scope" className="field-select" value={config.scope} onChange={e => update("scope", e.target.value)}>
                    <option value="">Choose scope…</option>
                    {SCOPE_OPTIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-field full">
                  <label htmlFor="theme">Central Theme <span className="optional">(optional)</span></label>
                  <input id="theme" className="field-input" placeholder="e.g. betrayal, redemption, identity, survival…" value={config.theme} onChange={e => update("theme", e.target.value)} />
                </div>
                <div className="form-field full">
                  <label htmlFor="extra">Additional Details <span className="optional">(optional)</span></label>
                  <textarea id="extra" className="field-textarea" placeholder="Describe a character, setting, specific premise, or anything else to shape your tale…" value={config.extra} onChange={e => update("extra", e.target.value)} />
                </div>
              </div>
              <button className="begin-btn" onClick={generateOptions} disabled={!canBegin}>
                Begin Your Story
              </button>
            </div>
          </div>
        )}

        {/* ── LOADING ── */}
        {screen === "loading" && (
          <div className="loading-wrap">
            <div className="rune-spinner" />
            <div className="loading-text">{loadingMsg}</div>
          </div>
        )}

        {/* ── STORY PICKER ── */}
        {screen === "picker" && (
          <div className="title-screen">
            <div className="title-ornament">✦ ✦ ✦</div>
            <h1 className="title-main">Scribe</h1>
            <p className="title-sub">Choose Your Path</p>

            {error && <div className="error-banner">{error}</div>}

            <p className="picker-prompt">Three tales await. Which calls to you?</p>

            <div className="story-options">
              {storyOptions.map((option, i) => (
                <button key={i} className="story-option-card" onClick={() => startChosenStory(option)}>
                  <div className="option-number">{["I", "II", "III"][i]}</div>
                  <div className="option-body">
                    <div className="option-title">{option.title}</div>
                    <div className="option-synopsis">{option.synopsis}</div>
                  </div>
                  <div className="option-arrow">›</div>
                </button>
              ))}
            </div>

            <button className="back-btn" onClick={() => setScreen("setup")}>← Back to Settings</button>
          </div>
        )}

        {/* ── STORY ── */}
        {(screen === "story" || screen === "ending") && current && (
          <>
            <div className="story-header">
              <div className="story-title">{storyTitle}</div>
              <div className="header-right">
                <div className="chapter-badge">
                  {screen === "ending" ? `The End · ${chapter} Chapters` : `Chapter ${chapter}`}
                </div>
                <button className="restart-btn" onClick={restart}>✕ Restart</button>
              </div>
            </div>

            {/* History */}
            {history.map((h, i) => (
              <div key={i} className="history-entry">
                {i > 0 && <div className="history-choice">► {h.choice}</div>}
                <div className="history-text">{h.passage}</div>
              </div>
            ))}
            {history.length > 0 && (
              <div className="history-entry">
                <div className="history-choice">► {history[history.length - 1]?.choice}</div>
              </div>
            )}

            {/* Current passage */}
            <div className="scroll-pane" onClick={skipTyping} style={{ cursor: typing ? "pointer" : "default" }}>
              {typing && <div className="skip-hint">click to reveal all</div>}
              <div className="story-text">
                {displayedText}
                {typing && <span className="cursor-blink" />}
              </div>
            </div>

            {error && <div className="error-banner" style={{ marginTop: 16 }}>{error}</div>}

            {/* Choices */}
            {screen === "story" && !typing && current.choices?.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <div className="divider">· · ✦ · ·</div>
                <div className="choices-label">What do you do?</div>
                <div className="choices">
                  {current.choices.map((c, i) => (
                    <button key={i} className="choice-btn" onClick={() => makeChoice(c, i)}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Ending */}
            {screen === "ending" && !typing && (
              <div className="ending-wrap">
                <div className="ending-ornament">✦ ✦ ✦</div>
                <div className="ending-title">Your Story is Complete</div>
                <div className="ending-sub">A tale {chapter} chapters long, shaped by your choices alone.</div>
                <button className="play-again-btn" onClick={restart}>Begin a New Story</button>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}

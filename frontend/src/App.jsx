import { useState, useEffect, useRef } from "react";
import OnboardingQuiz from "./components/OnboardingQuiz";
import ChatWindow from "./components/ChatWindow";
import "./App.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
const API_KEY = import.meta.env.VITE_API_KEY || "";
const authHeaders = { "Content-Type": "application/json", "x-api-key": API_KEY };

function fetchWithTimeout(url, options = {}, ms = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

// Generate or retrieve a persistent session ID
function getSessionId() {
  let id = localStorage.getItem("sarcast_session_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("sarcast_session_id", id);
  }
  return id;
}

export default function App() {
  const [phase, setPhase] = useState("loading"); // loading | onboarding | chat
  const [vibe, setVibe] = useState("dry");
  const [vibeLabel, setVibeLabel] = useState("");
  const [model, setModel] = useState("llama-3.3-70b");
  const [models, setModels] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cues, setCues] = useState([]);
  const [sarcasmIntensity, setSarcasmIntensity] = useState(5);
  const [sessionId] = useState(getSessionId);
  const userMsgCountRef = useRef(0);

  useEffect(() => {
    // Load models
    fetchWithTimeout(`${BACKEND_URL}/models`, { headers: authHeaders })
      .then(r => r.json())
      .then(setModels)
      .catch(() => setModels(["zephyr-7b"]));

    // Check if returning user has a profile
    fetchWithTimeout(`${BACKEND_URL}/profile/${sessionId}`, { headers: authHeaders })
      .then(r => r.json())
      .then(data => {
        if (data.exists) {
          setVibe(data.vibe);
          setVibeLabel(data.vibe_label || data.vibe);
          setSarcasmIntensity(data.sarcasm_intensity || 5);
          setCues(typeof data.cues === "string" ? JSON.parse(data.cues) : data.cues || []);
          setPhase("chat");
        } else {
          setPhase("onboarding");
        }
      })
      .catch(() => setPhase("onboarding"));
  }, [sessionId]);

  const handleOnboardingComplete = async (answers, jokeRatings) => {
    try {
      const res = await fetchWithTimeout(`${BACKEND_URL}/onboarding`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ ...answers, joke_ratings: jokeRatings, session_id: sessionId }),
      });
      const data = await res.json();
      setVibe(data.vibe);
      setVibeLabel(data.label);
      setSarcasmIntensity(data.sarcasm_intensity);
      setCues(data.cues || []);
    } catch {
      setVibe("dry");
      setVibeLabel("Dry & Deadpan");
    }
    setPhase("chat");
  };

  const handleSend = async (message) => {
    const userMsg = { id: crypto.randomUUID(), role: "user", content: message };
    const newHistory = [...history, userMsg];
    setHistory(newHistory);
    setLoading(true);
    const msgCount = ++userMsgCountRef.current;

    try {
      // Re-read vibe every 5 user messages
      let currentCues = cues;
      let currentVibe = vibe;
      if (msgCount % 5 === 0) {
        const adaptRes = await fetchWithTimeout(`${BACKEND_URL}/adapt-vibe`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            history: newHistory,
            current_vibe: vibe,
            session_id: sessionId,
            existing_cues: cues,
          }),
        }, 15000);
        const adaptData = await adaptRes.json();
        currentCues = adaptData.cues;
        currentVibe = adaptData.vibe;
        setCues(adaptData.cues);
        if (adaptData.changed) {
          setVibe(adaptData.vibe);
          setVibeLabel(adaptData.label);
        }
      }

      const res = await fetchWithTimeout(`${BACKEND_URL}/chat`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          message,
          vibe: currentVibe,
          model,
          history,
          session_id: sessionId,
          cues: currentCues,
          sarcasm_intensity: sarcasmIntensity,
        }),
      }, 15000);
      const data = await res.json();
      setHistory([...newHistory, { id: crypto.randomUUID(), role: "assistant", content: data.reply }]);
    } catch {
      setHistory([...newHistory, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Even the server is too tired to be sarcastic right now. Try again."
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (phase === "loading") {
    return (
      <div className="app">
        <div className="loading-screen">
          <div className="loading-logo">🎭</div>
          <p>Loading your vibe...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {phase === "onboarding" ? (
        <OnboardingQuiz onComplete={handleOnboardingComplete} backendUrl={BACKEND_URL} />
      ) : (
        <ChatWindow
          history={history}
          onSend={handleSend}
          loading={loading}
          vibe={vibe}
          vibeLabel={vibeLabel}
          model={model}
          models={models}
          cues={cues}
          sarcasmIntensity={sarcasmIntensity}
          onSarcasmIntensityChange={setSarcasmIntensity}
          onModelChange={setModel}
          onVibeChange={(v, l) => { setVibe(v); setVibeLabel(l); }}
          backendUrl={BACKEND_URL}
        />
      )}
    </div>
  );
}

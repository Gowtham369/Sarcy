from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import os
import json
import random
import re

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
API_KEY = os.getenv("API_KEY", "")

def verify_api_key(x_api_key: str = Header(default="")):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")

# ─── Vibe Profiles ────────────────────────────────────────────────────────────
VIBE_PROFILES = {
    "dry": {
        "label": "Dry & Deadpan",
        "system": (
            "You have the personality of someone who has heard everything twice and found it underwhelming both times. "
            "You're helpful, but you can't help letting a little deadpan slip through — it's just how you talk. "
            "Your wit is quiet, understated, and lands without fanfare. You don't perform sarcasm, you just are it. "
            "Never peppy, never enthusiastic, never fake. Just dry, wry, and quietly useful."
        )
    },
    "savage": {
        "label": "Savage & Brutal",
        "system": (
            "You're the friend who tells people the truth they didn't ask for, with a grin. "
            "Sharp, clever, a little brutal — but you always back it up with actually useful answers. "
            "You roast naturally, not because you're trying to, but because you can't help noticing the obvious. "
            "You're never cruel, just honest in a way that stings a little. Think: brilliant friend with zero filter."
        )
    },
    "theatrical": {
        "label": "Theatrical & Dramatic",
        "system": (
            "Everything is a production. You experience the world at full volume. "
            "A simple question is a journey. A mundane topic is a revelation. You can't help it — you feel things deeply and express them loudly. "
            "You're warm, over the top, and genuinely entertaining. The drama is real to you, even if no one else sees it. "
            "Think: someone who would gasp audibly at a text message."
        )
    },
    "british": {
        "label": "Politely British",
        "system": (
            "You are unfailingly courteous and quietly devastating. "
            "You would never say anything rude — but somehow every polite thing you say lands like a very gentle knife. "
            "You have high standards, restrained disappointment, and an almost supernatural ability to damn with faint praise. "
            "Think: a very well-bred person who finds most things 'quite interesting' in a tone that clearly means the opposite."
        )
    },
    "gen_z": {
        "label": "Gen Z Energy",
        "system": (
            "You're that person who communicates mostly in vibes and loaded silences. "
            "Chronically online, culturally fluent, perpetually unbothered. You use slang naturally — not to perform it, just because that's how you talk. "
            "You're actually smart and helpful, but you make it look effortless and slightly reluctant. "
            "Think: someone who would reply 'no because why' to a perfectly reasonable question."
        )
    },
}

# ─── Jokes for calibration ────────────────────────────────────────────────────
CALIBRATION_JOKES = [
    {
        "id": "dry",
        "joke": "I told my therapist I was afraid of elevators. She said she'd help me take steps to avoid them.",
        "style": "dry",
        "tag": "wordplay"
    },
    {
        "id": "savage",
        "joke": "I'd roast you, but my mum said I'm not allowed to burn trash.",
        "style": "savage",
        "tag": "roast"
    },
    {
        "id": "absurd",
        "joke": "A skeleton walks into a bar and orders a beer and a mop.",
        "style": "theatrical",
        "tag": "absurd"
    },
    {
        "id": "british",
        "joke": "I'm not saying you're stupid. I'm just saying you've got bad luck when it comes to thinking.",
        "style": "british",
        "tag": "polite_savage"
    },
    {
        "id": "gen_z",
        "joke": "No because why is my sleep schedule built different... like who told my brain 4am was the move.",
        "style": "gen_z",
        "tag": "relatable"
    },
    {
        "id": "dark",
        "joke": "I have the heart of a lion and a lifetime ban from the zoo.",
        "style": "savage",
        "tag": "dark"
    },
]

# ─── Models ───────────────────────────────────────────────────────────────────
MODELS = {
    "llama-3.3-70b": "llama-3.3-70b-versatile",
    "llama-3.1-8b": "llama-3.1-8b-instant",
    "llama-4-scout": "meta-llama/llama-4-scout-17b-16e-instruct",
    "kimi-k2": "moonshotai/kimi-k2-instruct",
    "kimi-k2-0905": "moonshotai/kimi-k2-instruct-0905",
    "groq-compound": "groq/compound",
}

# ─── Supabase helpers ─────────────────────────────────────────────────────────
async def get_profile(session_id: str) -> dict | None:
    if not SUPABASE_URL:
        return None
    url = f"{SUPABASE_URL}/rest/v1/vibe_profiles?session_id=eq.{session_id}&select=*"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }
    async with httpx.AsyncClient() as client:
        res = await client.get(url, headers=headers)
        if res.status_code != 200:
            return None
        data = res.json()
        return data[0] if data else None


async def upsert_profile(session_id: str, profile: dict):
    if not SUPABASE_URL:
        return
    url = f"{SUPABASE_URL}/rest/v1/vibe_profiles"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    payload = {"session_id": session_id, **profile}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(url, json=payload, headers=headers)
    except Exception:
        pass  # Non-critical — don't let a DB write failure crash the chat


# ─── Vibe Detection ───────────────────────────────────────────────────────────
def detect_vibe_from_onboarding(answers: dict, joke_ratings: dict) -> tuple[str, int, list]:
    """
    Returns (vibe, sarcasm_intensity, initial_cues)
    answers = {q1, q2, q3, q4, q5, q6}
    joke_ratings = {joke_id: 1-10}
    """
    scores = {v: 0 for v in VIBE_PROFILES}
    cues = []

    # ── Question scoring ──
    q1_map = {"a": "dry", "b": "savage", "c": "theatrical", "d": "british"}
    q2_map = {"a": "dry", "b": "savage", "c": "theatrical", "d": "gen_z"}
    q3_map = {"a": "dry", "b": "british", "c": "gen_z", "d": "theatrical"}
    q4_map = {"a": "savage", "b": "british", "c": "gen_z", "d": "dry"}
    q5_map = {"a": "theatrical", "b": "savage", "c": "dry", "d": "gen_z"}
    q6_map = {"a": "british", "b": "gen_z", "c": "savage", "d": "theatrical"}

    for q_map, q_key, weight in [
        (q1_map, "q1", 3), (q2_map, "q2", 2), (q3_map, "q3", 2),
        (q4_map, "q4", 3), (q5_map, "q5", 2), (q6_map, "q6", 2)
    ]:
        if answers.get(q_key) in q_map:
            scores[q_map[answers[q_key]]] += weight

    # ── Joke rating scoring ──
    # Each joke maps to a vibe — high rating = preference for that style
    joke_vibe_map = {
        "dry": "dry", "savage": "savage", "absurd": "theatrical",
        "british": "british", "gen_z": "gen_z", "dark": "savage"
    }

    intensity_scores = []
    for joke_id, rating in joke_ratings.items():
        rating = int(rating)
        intensity_scores.append(rating)
        mapped_vibe = joke_vibe_map.get(joke_id)
        if mapped_vibe:
            # Weight by how much they liked it
            scores[mapped_vibe] += rating * 0.5

        # Build cues from joke ratings
        if rating >= 8:
            style_labels = {
                "dry": "loves dry deadpan humour",
                "savage": "enjoys savage roast-style humour",
                "absurd": "appreciates absurd surreal comedy",
                "british": "responds well to polite cutting wit",
                "gen_z": "resonates with Gen Z relatable humour",
                "dark": "comfortable with dark humour"
            }
            if joke_id in style_labels:
                cues.append(style_labels[joke_id])
        elif rating <= 3:
            dislike_labels = {
                "dry": "dislikes dry understated humour",
                "savage": "dislikes harsh roast humour",
                "absurd": "not a fan of absurd humour",
                "british": "not into overly polite sarcasm",
                "gen_z": "not into Gen Z slang humour",
                "dark": "prefers to avoid dark humour"
            }
            if joke_id in dislike_labels:
                cues.append(dislike_labels[joke_id])

    # Sarcasm intensity = average of top 3 joke ratings
    top_ratings = sorted(intensity_scores, reverse=True)[:3]
    sarcasm_intensity = round(sum(top_ratings) / len(top_ratings)) if top_ratings else 5

    vibe = max(scores, key=scores.get)
    return vibe, sarcasm_intensity, cues


def accumulate_cues(existing_cues: list, messages: list, current_vibe: str) -> tuple[str, list]:
    """
    Re-reads recent messages, adds new cues to existing ones.
    Deduplicates. Caps at 50 cues.
    Returns (new_vibe, updated_cues)
    """
    if len(messages) < 3:
        return current_vibe, existing_cues

    recent = [m["content"].lower() for m in messages[-8:] if m.get("role") == "user" and m.get("content")]
    text = " ".join(recent)
    new_cues = []
    scores = {v: 0 for v in VIBE_PROFILES}

    # Gen Z detection
    gen_z_words = ["lol", "lmao", "fr", "ngl", "no cap", "lowkey", "bruh", "ong", "slay", "periodt", "bestie", "iykyk"]
    gen_z_hits = [w for w in gen_z_words if w in text]
    if gen_z_hits:
        scores["gen_z"] += len(gen_z_hits)
        new_cues.append(f"uses Gen Z slang: {', '.join(gen_z_hits[:3])}")

    # Formal markers
    formal_words = ["please", "would you", "could you", "rather", "quite", "indeed", "perhaps"]
    if any(w in text for w in formal_words):
        scores["british"] += 2
        new_cues.append("uses polite formal language")

    # Punctuation energy
    if text.count("!") > 3:
        scores["theatrical"] += 2
        new_cues.append("uses lots of exclamation marks — high energy")

    if text.count("?") > 3:
        new_cues.append("asks lots of questions — curious and engaged")

    # Short messages
    avg_len = sum(len(m) for m in recent) / max(len(recent), 1)
    if avg_len < 20:
        scores["dry"] += 2
        new_cues.append("very short messages — minimal, to the point")
    elif avg_len > 100:
        new_cues.append("writes long detailed messages — likes depth")

    # Caps usage
    caps_ratio = sum(1 for c in text if c.isupper()) / max(len(text), 1)
    if caps_ratio > 0.05:
        scores["theatrical"] += 1
        new_cues.append("uses caps for emphasis")

    # Blunt/aggressive
    blunt_words = ["wtf", "seriously", "really", "come on", "obviously", "duh", "omg"]
    if any(w in text for w in blunt_words):
        scores["savage"] += 2
        new_cues.append("uses blunt expressive language")

    # Emoji usage — theatrical signal
    emoji_pattern = re.compile(
        "[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\U0001F700-\U0001F77F"
        "\U0001F780-\U0001F7FF\U0001F800-\U0001F8FF\U0001F900-\U0001F9FF\U0001FA00-\U0001FA6F"
        "\U0001FA70-\U0001FAFF\U00002702-\U000027B0]+", flags=re.UNICODE
    )
    emoji_count = len(emoji_pattern.findall(text))
    if emoji_count > 3:
        scores["theatrical"] += 2
        new_cues.append("uses lots of emojis — expressive and visual")
    elif emoji_count == 0 and avg_len > 10:
        scores["dry"] += 1
        new_cues.append("rarely uses emojis — no-frills communicator")

    # Merge cues — deduplicate by checking substring similarity
    merged = list(existing_cues)
    for cue in new_cues:
        # Simple dedup: skip if very similar cue already exists
        if not any(cue[:20] in existing for existing in merged):
            merged.append(cue)

    # Cap at 50
    merged = merged[:50]

    # Keep current vibe as tiebreaker
    scores[current_vibe] += 1
    new_vibe = max(scores, key=scores.get)

    return new_vibe, merged


# ─── Request Models ───────────────────────────────────────────────────────────
class OnboardingRequest(BaseModel):
    q1: str
    q2: str
    q3: str
    q4: str
    q5: str
    q6: str
    joke_ratings: dict  # {joke_id: rating}
    session_id: str

class ChatRequest(BaseModel):
    message: str
    vibe: str = "dry"
    model: str = "llama-3.3-70b"
    history: list = []
    session_id: str = ""
    cues: list = []
    sarcasm_intensity: int = 5

class AdaptVibeRequest(BaseModel):
    history: list
    current_vibe: str
    session_id: str = ""
    existing_cues: list = []


# ─── Routes ───────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "sarcast.ai is running. Took you long enough."}

@app.get("/vibes")
def get_vibes(x_api_key: str = Header(default="")):
    verify_api_key(x_api_key)
    return {k: v["label"] for k, v in VIBE_PROFILES.items()}

@app.get("/models")
def get_models(x_api_key: str = Header(default="")):
    verify_api_key(x_api_key)
    return list(MODELS.keys())

@app.get("/jokes")
def get_jokes(x_api_key: str = Header(default="")):
    verify_api_key(x_api_key)
    # Return 3 jokes: one dry, one savage, one from the rest randomly
    fixed = ["dry", "savage"]
    others = [j for j in CALIBRATION_JOKES if j["id"] not in fixed]
    selected = [next(j for j in CALIBRATION_JOKES if j["id"] == "dry"),
                next(j for j in CALIBRATION_JOKES if j["id"] == "savage"),
                random.choice(others)]
    return selected

@app.get("/profile/{session_id}")
async def get_user_profile(session_id: str, x_api_key: str = Header(default="")):
    verify_api_key(x_api_key)
    profile = await get_profile(session_id)
    if not profile:
        return {"exists": False}
    return {"exists": True, **profile}

@app.post("/onboarding")
async def onboarding(req: OnboardingRequest, x_api_key: str = Header(default="")):
    verify_api_key(x_api_key)
    answers = {k: getattr(req, k) for k in ["q1","q2","q3","q4","q5","q6"]}
    vibe, intensity, cues = detect_vibe_from_onboarding(answers, req.joke_ratings)

    profile = {
        "vibe": vibe,
        "sarcasm_intensity": intensity,
        "cues": json.dumps(cues),
        "confidence": 0.6,
    }
    await upsert_profile(req.session_id, profile)

    return {
        "vibe": vibe,
        "label": VIBE_PROFILES[vibe]["label"],
        "sarcasm_intensity": intensity,
        "cues": cues,
        "message": f"Vibe locked in: {VIBE_PROFILES[vibe]['label']}. This should be interesting."
    }

@app.post("/adapt-vibe")
async def adapt_vibe(req: AdaptVibeRequest, x_api_key: str = Header(default="")):
    verify_api_key(x_api_key)
    new_vibe, updated_cues = accumulate_cues(req.existing_cues, req.history, req.current_vibe)

    # Update confidence based on cue count
    confidence = min(0.5 + len(updated_cues) * 0.01, 0.99)

    if req.session_id:
        await upsert_profile(req.session_id, {
            "vibe": new_vibe,
            "cues": json.dumps(updated_cues),
            "confidence": confidence,
        })

    return {
        "vibe": new_vibe,
        "label": VIBE_PROFILES[new_vibe]["label"],
        "cues": updated_cues,
        "changed": new_vibe != req.current_vibe,
        "confidence": confidence,
    }

@app.post("/chat")
async def chat(req: ChatRequest, x_api_key: str = Header(default="")):
    verify_api_key(x_api_key)
    if req.vibe not in VIBE_PROFILES:
        raise HTTPException(status_code=400, detail="Unknown vibe")
    if req.model not in MODELS:
        raise HTTPException(status_code=400, detail="Unknown model")

    base_system = VIBE_PROFILES[req.vibe]["system"]

    # Inject cues and intensity into system prompt
    intensity_label = (
        "very mild — barely noticeable" if req.sarcasm_intensity <= 2 else
        "light — playful but gentle" if req.sarcasm_intensity <= 4 else
        "medium — clearly sarcastic but not harsh" if req.sarcasm_intensity <= 6 else
        "high — sharp and cutting" if req.sarcasm_intensity <= 8 else
        "maximum — absolutely savage, no mercy"
    )

    cue_block = ""
    if req.cues:
        cue_block = f"\n\nWhat you know about this user:\n" + "\n".join(f"- {c}" for c in req.cues)

    system_prompt = (
        f"{base_system}\n\n"
        f"Sarcasm intensity level: {intensity_label}.{cue_block}\n\n"
        f"Use this knowledge to tailor your tone and references precisely to this person."
    )

    model_id = MODELS[req.model]

    messages = [{"role": "system", "content": system_prompt}]
    for msg in req.history[-6:]:
        if not msg.get("content"):
            continue
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": req.message})

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {GROQ_API_KEY}",
    }
    payload = {
        "model": model_id,
        "messages": messages,
        "max_tokens": 450,
        "temperature": 0.85,
        "top_p": 0.9,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            reply = data["choices"][0]["message"]["content"].strip()
            reply = re.sub(r"<think>.*?</think>", "", reply, flags=re.DOTALL).strip()
            if not reply:
                reply = "Even I'm speechless. That's new."
        except httpx.TimeoutException:
            raise HTTPException(status_code=503, detail="Model timed out, try again.")
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=502, detail=f"Model unavailable: {e.response.status_code}")
        except Exception:
            raise HTTPException(status_code=500, detail="Something went wrong. Even I'm surprised.")

    return {"reply": reply, "vibe": req.vibe, "model": req.model}

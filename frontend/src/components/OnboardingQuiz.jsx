import { useState, useEffect } from "react";
import "./OnboardingQuiz.css";

const QUESTIONS = [
  {
    id: "q1",
    question: "Your friend texts you 'what's 2+2?' How do you respond?",
    options: [
      { id: "a", text: "...4.", emoji: "😐" },
      { id: "b", text: "Oh WOW, revolutionary question.", emoji: "💀" },
      { id: "c", text: "FOUR. THE ANSWER IS FOUR. ARE YOU OK??", emoji: "😱" },
      { id: "d", text: "Splendid inquiry. Four, if you'd be so kind.", emoji: "🎩" },
    ]
  },
  {
    id: "q2",
    question: "Someone asks you to explain something you already explained twice.",
    options: [
      { id: "a", text: "Sure. *explains again, completely monotone*", emoji: "🪨" },
      { id: "b", text: "Absolutely. For the third time.", emoji: "🔪" },
      { id: "c", text: "Oh! Oh my! AGAIN? From the TOP?!", emoji: "🎭" },
      { id: "d", text: "No cap, did you actually hear me the first time tho", emoji: "💅" },
    ]
  },
  {
    id: "q3",
    question: "Pick your energy level on a normal day:",
    options: [
      { id: "a", text: "Flat. Perfectly, intentionally flat.", emoji: "📄" },
      { id: "b", text: "Properly composed, deeply unimpressed.", emoji: "☕" },
      { id: "c", text: "Lowkey unbothered, just vibing fr", emoji: "😮‍💨" },
      { id: "d", text: "CHAOTIC. EVERYTHING IS DRAMATIC.", emoji: "🌪️" },
    ]
  },
  {
    id: "q4",
    question: "Someone is visibly wrong on the internet. You:",
    options: [
      { id: "a", text: "Correct them with zero emotion. Just facts.", emoji: "🗿" },
      { id: "b", text: "Write a perfectly worded, devastatingly polite reply.", emoji: "🎩" },
      { id: "c", text: "Bestie... no. Just... no.", emoji: "💅" },
      { id: "d", text: "You absolute walnut. Allow me to explain.", emoji: "💀" },
    ]
  },
  {
    id: "q5",
    question: "How do you take a compliment?",
    options: [
      { id: "a", text: "Oh, it was nothing. Literally nothing.", emoji: "😑" },
      { id: "b", text: "*internally panicking* Thanks I guess", emoji: "😅" },
      { id: "c", text: "Obviously. I know.", emoji: "😎" },
      { id: "d", text: "OH MY GOD THANK YOU THIS IS THE BEST DAY", emoji: "🤩" },
    ]
  },
  {
    id: "q6",
    question: "Your ideal AI assistant is:",
    options: [
      { id: "a", text: "Classy, composed, slightly condescending.", emoji: "🎩" },
      { id: "b", text: "Chaotic bestie who gets the assignment", emoji: "💅" },
      { id: "c", text: "Ruthless. Roasts me but is always right.", emoji: "💀" },
      { id: "d", text: "So dramatic it's actually hilarious", emoji: "🎭" },
    ]
  }
];

const JOKE_LABELS = [
  "Not funny at all",
  "", "", "",
  "Okay I guess",
  "", "", "", "",
  "Actually crying 😭"
];

export default function OnboardingQuiz({ onComplete, backendUrl }) {
  const [phase, setPhase] = useState("questions"); // questions | jokes | done
  const [answers, setAnswers] = useState({});
  const [currentQ, setCurrentQ] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [jokes, setJokes] = useState([]);
  const [ratings, setRatings] = useState({});
  const [currentJoke, setCurrentJoke] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(null);

  const authHeaders = { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_API_KEY || "" };

  useEffect(() => {
    fetch(`${backendUrl}/jokes`, { headers: authHeaders })
      .then(r => r.json())
      .then(setJokes)
      .catch(() => setJokes([
        { id: "dry", joke: "I told my therapist I was afraid of elevators. She said she'd help me take steps to avoid them." },
        { id: "savage", joke: "I'd roast you, but my mum said I'm not allowed to burn trash." },
        { id: "absurd", joke: "A skeleton walks into a bar and orders a beer and a mop." }
      ]));
  }, [backendUrl]);

  const handleAnswer = (questionId, optionId) => {
    const newAnswers = { ...answers, [questionId]: optionId };
    setAnswers(newAnswers);
    setAnimating(true);
    setTimeout(() => {
      setAnimating(false);
      if (currentQ < QUESTIONS.length - 1) {
        setCurrentQ(currentQ + 1);
      } else {
        setPhase("jokes");
      }
    }, 350);
  };

  const handleRating = (jokeId, rating) => {
    const newRatings = { ...ratings, [jokeId]: rating };
    setRatings(newRatings);
    setAnimating(true);
    setTimeout(() => {
      setAnimating(false);
      if (currentJoke < jokes.length - 1) {
        setCurrentJoke(currentJoke + 1);
      } else {
        onComplete(answers, newRatings);
      }
    }, 350);
  };

  const totalSteps = QUESTIONS.length + jokes.length;
  const currentStep = phase === "questions" ? currentQ : QUESTIONS.length + currentJoke;
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="quiz-container">
      <div className="quiz-header">
        <div className="quiz-logo">🎭 sarcast.ai</div>
        <p className="quiz-subtitle">
          {phase === "questions"
            ? "Let's figure out what kind of insufferable you are."
            : "Now rate these jokes. Don't lie to yourself."}
        </p>
      </div>

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <p className="progress-text">
        {phase === "questions"
          ? `Question ${currentQ + 1} of ${QUESTIONS.length}`
          : `Joke ${currentJoke + 1} of ${jokes.length}`}
      </p>

      {/* Phase label */}
      <div className="phase-pills">
        <span className={`phase-pill ${phase === "questions" ? "active" : "done"}`}>
          {phase === "questions" ? "⚡ Vibe Check" : "✓ Vibe Check"}
        </span>
        <span className="phase-divider">→</span>
        <span className={`phase-pill ${phase === "jokes" ? "active" : phase === "done" ? "done" : ""}`}>
          😂 Joke Rating
        </span>
      </div>

      {phase === "questions" && (
        <div className={`quiz-card ${animating ? "fade-out" : "fade-in"}`}>
          <h2 className="quiz-question">{QUESTIONS[currentQ].question}</h2>
          <div className="quiz-options">
            {QUESTIONS[currentQ].options.map(opt => (
              <button
                key={opt.id}
                className="quiz-option"
                onClick={() => handleAnswer(QUESTIONS[currentQ].id, opt.id)}
              >
                <span className="option-emoji">{opt.emoji}</span>
                <span className="option-text">{opt.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === "jokes" && jokes.length > 0 && (
        <div className={`quiz-card ${animating ? "fade-out" : "fade-in"}`}>
          <p className="joke-label">Rate this joke:</p>
          <div className="joke-card">
            <p className="joke-text">"{jokes[currentJoke]?.joke}"</p>
          </div>
          <div className="rating-row">
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <button
                key={n}
                className={`rating-btn ${hoveredRating >= n ? "hovered" : ""}`}
                onMouseEnter={() => setHoveredRating(n)}
                onMouseLeave={() => setHoveredRating(null)}
                onClick={() => handleRating(jokes[currentJoke].id, n)}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="rating-labels">
            <span>😐 Not funny</span>
            <span>😭 Crying laughing</span>
          </div>
        </div>
      )}
    </div>
  );
}

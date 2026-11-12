import { useEffect, useRef, useState } from 'react';

export default function useMatchTimer(onBoost) {
  const [secondsLeft, setSecondsLeft] = useState(600);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const secondsRef = useRef(600);
  const boostRef = useRef(onBoost);
  boostRef.current = onBoost;

  useEffect(() => {
    if (!isRunning) return undefined;
    const interval = window.setInterval(() => {
      if (secondsRef.current <= 1) {
        secondsRef.current = 600;
        setSecondsLeft(600);
        boostRef.current(0.1);
      } else {
        secondsRef.current -= 1;
        setSecondsLeft(secondsRef.current);
      }
      setElapsedMinutes((minutes) => minutes + 1 / 60);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isRunning]);

  const reset = () => { secondsRef.current = 600; setSecondsLeft(600); setElapsedMinutes(0); };
  const restore = (state) => {
    secondsRef.current = state.secondsLeft;
    setSecondsLeft(state.secondsLeft);
    setElapsedMinutes(state.elapsedMinutes);
    setIsRunning(state.isRunning);
  };
  const fastForward = (minutes = 10) => {
    setElapsedMinutes((elapsed) => elapsed + minutes);
    const boosts = Math.floor(minutes / 10);
    if (boosts > 0) onBoost(Number((boosts * 0.1).toFixed(2)));
  };

  return { secondsLeft, elapsedMinutes, isRunning, setIsRunning, reset, fastForward, restore };
}

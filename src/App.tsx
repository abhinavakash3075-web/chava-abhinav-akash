import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, TerminalSquare } from 'lucide-react';

// --- TRACK DEFINITIONS ---
const TRACKS = [
  { id: 1, title: 'SYS.INIT_01.WAV', type: 'square' as OscillatorType, baseFreq: 220, speed: 200 },
  { id: 2, title: 'CORRUPT_SEQ_02.AIF', type: 'sawtooth' as OscillatorType, baseFreq: 110, speed: 150 },
  { id: 3, title: 'GHOST_DATA_03.BIN', type: 'triangle' as OscillatorType, baseFreq: 440, speed: 300 },
];

export default function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  
  // Game State
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(true);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // --- AUDIO SYNTHESIS ---
  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number | null>(null);
  const stepRef = useRef(0);

  const playNote = (freq: number, type: OscillatorType, duration: number) => {
    if (!audioCtxRef.current || isMuted) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    
    // Envelope
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  };

  useEffect(() => {
    if (isPlaying) {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const track = TRACKS[currentTrackIndex];
      stepRef.current = 0;
      
      intervalRef.current = window.setInterval(() => {
        const step = stepRef.current;
        let freq = track.baseFreq;
        
        // Pseudo-random pseudo-melodic generative algorithm
        if (track.id === 1) {
          const notes = [1, 1.2, 1.5, 1.2, 2, 1.5, 1, 0.8];
          freq *= notes[step % notes.length];
        } else if (track.id === 2) {
          const notes = [1, 1.5, 2, 1.2, 0.5, 1];
          freq *= notes[step % notes.length];
          if (Math.random() > 0.8) freq *= 2; // Glitch
        } else {
          const notes = [1, 1.25, 1.33, 1.5, 1.66, 2];
          freq *= notes[Math.floor(Math.sin(step) * 2.5 + 2.5)];
        }
        
        playNote(freq, track.type, track.speed / 1000);
        stepRef.current++;
      }, track.speed);
      
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, currentTrackIndex, isMuted]);

  const togglePlay = () => setIsPlaying(!isPlaying);
  const nextTrack = () => setCurrentTrackIndex((i) => (i + 1) % TRACKS.length);
  const prevTrack = () => setCurrentTrackIndex((i) => (i - 1 + TRACKS.length) % TRACKS.length);

  // --- SNAKE GAME LOGIC ---
  const gridSize = 20;
  const tileSize = 20; // Will be scaled in canvas logic
  
  const snakeRef = useRef([{x: 10, y: 10}]);
  const dirRef = useRef({x: 0, y: -1});
  const nextDirRef = useRef({x: 0, y: -1});
  const foodRef = useRef({x: 5, y: 5});
  const gameIntervalRef = useRef<number | null>(null);

  const startGame = () => {
    setGameOver(false);
    setScore(0);
    snakeRef.current = [{x: 10, y: 10}, {x: 10, y: 11}, {x: 10, y: 12}];
    dirRef.current = {x: 0, y: -1};
    nextDirRef.current = {x: 0, y: -1};
    placeFood();
    
    if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
    gameIntervalRef.current = window.setInterval(gameLoop, 100);
    
    // Play synth sound on start
    playNote(800, 'square', 0.1);
  };
  
  const placeFood = () => {
    foodRef.current = {
      x: Math.floor(Math.random() * gridSize),
      y: Math.floor(Math.random() * gridSize)
    };
  };

  const gameLoop = () => {
    dirRef.current = nextDirRef.current;
    const head = { ...snakeRef.current[0] };
    head.x += dirRef.current.x;
    head.y += dirRef.current.y;
    
    // Wall collision
    if (head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize) {
      endGame();
      return;
    }
    
    // Self collision
    for (let i = 0; i < snakeRef.current.length; i++) {
        if (head.x === snakeRef.current[i].x && head.y === snakeRef.current[i].y) {
            endGame();
            return;
        }
    }

    snakeRef.current.unshift(head);
    
    // Food collision
    if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
      setScore(s => {
        const newScore = s + 10;
        if (newScore % 50 === 0) playNote(1200, 'triangle', 0.2); // Level up sound
        else playNote(600, 'square', 0.1); // Eat sound
        return newScore;
      });
      placeFood();
    } else {
      snakeRef.current.pop();
    }
    
    draw();
  };
  
  const endGame = () => {
    setGameOver(true);
    if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
    playNote(220, 'sawtooth', 0.5); // Death sound
    draw();
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const cellW = width / gridSize;
    const cellH = height / gridSize;
    
    // Clear
    ctx.fillStyle = '#050505'; // var(--color-black)
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid lines
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < gridSize; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellW, 0);
        ctx.lineTo(i * cellW, height);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, i * cellH);
        ctx.lineTo(width, i * cellH);
        ctx.stroke();
    }
    
    // Draw Snake
    ctx.fillStyle = '#0ff'; // Cyan
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#0ff';
    snakeRef.current.forEach((part, index) => {
        if (index === 0) {
            ctx.fillStyle = '#fff'; // Head is white
        } else {
            ctx.fillStyle = '#0ff';
        }
        // Glitch effect on head occasionally
        let xOffset = 0;
        if (index === 0 && Math.random() > 0.95) xOffset = (Math.random() - 0.5) * 5;
        
        ctx.fillRect(part.x * cellW + 1 + xOffset, part.y * cellH + 1, cellW - 2, cellH - 2);
    });
    
    // Draw Food
    ctx.shadowColor = '#f0f'; // Magenta
    ctx.fillStyle = '#f0f';
    
    // Food pulsing glitch
    const pulse = Math.sin(Date.now() / 100) * 2;
    ctx.fillRect(foodRef.current.x * cellW + 1 - pulse/2, foodRef.current.y * cellH + 1 - pulse/2, cellW - 2 + pulse, cellH - 2 + pulse);
    
    ctx.shadowBlur = 0; // reset
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch(e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (dirRef.current.y === 0) nextDirRef.current = {x: 0, y: -1};
          e.preventDefault();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          if (dirRef.current.y === 0) nextDirRef.current = {x: 0, y: 1};
          e.preventDefault();
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (dirRef.current.x === 0) nextDirRef.current = {x: -1, y: 0};
          e.preventDefault();
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (dirRef.current.x === 0) nextDirRef.current = {x: 1, y: 0};
          e.preventDefault();
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    draw(); // Initial draw
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [draw]);


  return (
    <div className="crt static-noise min-h-screen flex flex-col items-center justify-center p-4 relative font-mono text-cyan-400 bg-black">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-8 left-8 text-xs opacity-50 flex flex-col gap-1 pointer-events-none">
        <div>OS.VERSION = 9.9.9(GLITCH)</div>
        <div>MEMORY_USAGE: 4096KB</div>
        <div className="text-magenta-500">WARNING: CORRUPTED_SECTORS_DETECTED</div>
        <div>{'>'} AWAITING_INPUT_</div>
      </div>
      
      <div className="absolute bottom-8 right-8 text-xs opacity-50 pointer-events-none border border-cyan-400 p-2 text-right">
        <div className="uppercase">User: Root</div>
        <div className="uppercase">Net: Offline</div>
      </div>

      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-3 gap-8 relative z-20">
        
        {/* Left Column - Audio Player */}
        <div className="col-span-1 border-2 border-cyan-400 p-6 flex flex-col h-[500px] shadow-[0_0_20px_rgba(0,255,255,0.2)] bg-black/80 backdrop-blur-sm">
          <div className="flex items-center gap-2 border-b-2 border-cyan-400 pb-4 mb-4">
            <TerminalSquare size={24} className="text-magenta-500 screen-tear" />
            <h1 className="text-xl glitch font-bold" data-text="AI_AUDIO.EXE">AI_AUDIO.EXE</h1>
          </div>
          
          <div className="flex-1 flex flex-col">
            <div className="text-sm border border-cyan-800 p-3 mb-6 bg-cyan-950/30">
              <div className="mb-2 uppercase opacity-70 border-b border-cyan-800 pb-1 text-xs tracking-widest">Now Playing</div>
              {isPlaying ? (
                <div className="text-magenta-400 text-lg glitch" data-text={TRACKS[currentTrackIndex].title}>
                  {TRACKS[currentTrackIndex].title}
                </div>
              ) : (
                <div className="text-cyan-600 text-lg">[ PLAYBACK_PAUSED ]</div>
              )}
            </div>
            
            <div className="flex flex-col gap-2 mb-8 flex-1 overflow-y-auto">
              <div className="text-xs uppercase tracking-widest opacity-50 mb-2">Track_List</div>
              {TRACKS.map((track, i) => (
                <button 
                  key={track.id}
                  onClick={() => {
                    setCurrentTrackIndex(i);
                    if (!isPlaying) setIsPlaying(true);
                  }}
                  className={`text-left p-2 text-sm border-l-4 transition-all duration-200 ${currentTrackIndex === i ? 'border-magenta-500 bg-magenta-500/10 text-magenta-400' : 'border-cyan-800 hover:border-cyan-400 hover:bg-cyan-900/20'}`}
                >
                  <span className="opacity-50 inline-block w-6">0{i+1}</span>
                  {track.title}
                </button>
              ))}
            </div>
            
            {/* Controls */}
            <div className="flex items-center justify-between mt-auto border-t-2 border-cyan-400 pt-4">
              <div className="flex gap-4">
                <button onClick={prevTrack} className="hover:text-magenta-400 hover:scale-110 transition-all focus:outline-none">
                  <SkipBack fill="currentColor" />
                </button>
                <button onClick={togglePlay} className={`${isPlaying ? 'text-magenta-400' : 'text-cyan-400'} hover:scale-110 transition-all focus:outline-none`}>
                  {isPlaying ? <Pause fill="currentColor" size={32} /> : <Play fill="currentColor" size={32} />}
                </button>
                <button onClick={nextTrack} className="hover:text-magenta-400 hover:scale-110 transition-all focus:outline-none">
                  <SkipForward fill="currentColor" />
                </button>
              </div>
              <button 
                onClick={() => setIsMuted(!isMuted)} 
                className="hover:text-magenta-400 transition-colors focus:outline-none"
              >
                {isMuted ? <VolumeX /> : <Volume2 />}
              </button>
            </div>
          </div>
        </div>
        
        {/* Right Column - Snake Game */}
        <div className="col-span-1 md:col-span-2 border-2 border-cyan-400 shadow-[0_0_30px_rgba(255,0,255,0.1)] p-6 bg-black/80 backdrop-blur-sm relative">
            <div className="flex items-center justify-between mb-4 border-b-2 border-cyan-400 pb-2">
                <div className="text-xl glitch" data-text="OOUROBOROS.SYS">OOUROBOROS.SYS</div>
                <div className="text-lg">
                    SCORE: <span className="text-magenta-400">{score.toString().padStart(5, '0')}</span>
                </div>
            </div>
            
            <div className="relative">
                <canvas 
                    ref={canvasRef} 
                    width={400} 
                    height={400} 
                    className="w-full aspect-square border-2 border-cyan-800 focus:outline-none bg-black block"
                />
                
                {gameOver && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-8 text-center backdrop-blur-sm border-2 border-magenta-500 m-1">
                        <h2 className="text-4xl text-magenta-500 glitch mb-4" data-text="SYSTEM_FAILURE">SYSTEM_FAILURE</h2>
                        <p className="mb-8 opacity-80 text-sm tracking-widest leading-loose">
                            SERPENT_PROTOCOL_TERMINATED.<br/>
                            FINAL_SCORE: {score}<br/>
                            PRESS {'['}INITIALIZE{']'} TO REBOOT_
                        </p>
                        <button 
                            onClick={startGame}
                            className="border-2 border-cyan-400 px-8 py-3 uppercase tracking-widest hover:bg-cyan-400 hover:text-black transition-colors font-bold text-lg"
                        >
                            Initialize
                        </button>
                    </div>
                )}
            </div>
            
            <div className="mt-4 text-xs opacity-50 flex justify-between uppercase">
                <span>Controls: W_A_S_D / Arrows</span>
                <span className="animate-pulse text-magenta-400">{!gameOver ? 'STATUS: ACTIVE' : 'STATUS: OFFLINE'}</span>
            </div>
        </div>
        
      </div>
    </div>
  );
}

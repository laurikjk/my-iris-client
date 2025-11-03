let audioContext: AudioContext | null = null
let intervalId: ReturnType<typeof setInterval> | null = null

export function playRingtone() {
  if (!audioContext) {
    audioContext = new AudioContext()
  }

  stopRingtone() // Stop any existing ringtone

  const playTone = () => {
    if (!audioContext) return

    const currentTime = audioContext.currentTime

    // Create two oscillators for a pleasant harmony (major third interval)
    const osc1 = audioContext.createOscillator()
    const osc2 = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    osc1.connect(gainNode)
    osc2.connect(gainNode)
    gainNode.connect(audioContext.destination)

    // Use a major third interval (C5 and E5 notes) - sounds pleasant like a notification
    osc1.type = "sine"
    osc2.type = "sine"
    osc1.frequency.value = 523.25 // C5
    osc2.frequency.value = 659.25 // E5

    // Gentle volume envelope
    gainNode.gain.setValueAtTime(0, currentTime)
    gainNode.gain.linearRampToValueAtTime(0.15, currentTime + 0.03)
    gainNode.gain.setValueAtTime(0.15, currentTime + 0.15)
    gainNode.gain.linearRampToValueAtTime(0, currentTime + 0.25)

    // Play short pleasant beep
    osc1.start(currentTime)
    osc2.start(currentTime)
    osc1.stop(currentTime + 0.25)
    osc2.stop(currentTime + 0.25)

    osc1.onended = () => {
      osc1.disconnect()
      osc2.disconnect()
      gainNode.disconnect()
    }
  }

  // Play immediately
  playTone()

  // Then repeat every 3 seconds (less annoying)
  intervalId = setInterval(playTone, 3000)
}

export function stopRingtone() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}

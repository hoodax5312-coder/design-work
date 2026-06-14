
/**
 * Detects scenes in a video based on pixel difference and captures keyframes.
 * @param videoUrl The URL of the video to analyze.
 * @param threshold The threshold for pixel difference (0-255). Default is 30.
 * @returns A promise that resolves to an array of keyframes with time and image URL.
 */
export const detectScenesAndCapture = async (videoUrl: string, threshold = 30): Promise<{ time: number; url: string }[]> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = "anonymous";
    video.src = videoUrl;
    video.muted = true;

    const canvas = document.createElement('canvas');
    // willReadFrequently is important for performance when calling getImageData frequently
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
      reject(new Error("Could not get canvas context"));
      return;
    }

    const keyframes: { time: any; image: string }[] = [];
    let prevData: Uint8ClampedArray | null = null;

    video.onloadeddata = async () => {
      // Use a smaller canvas for detection to improve performance
      canvas.width = 320;
      canvas.height = Math.floor(320 * (video.videoHeight / video.videoWidth));

      const duration = video.duration;
      // Sample rate: checks every 0.5 seconds (2 times per second)
      const sampleRate = 2;

      video.currentTime = 0;

      const scan = async () => {
        // Check if scanning is complete
        const currentTime = video.currentTime;
        if (currentTime >= duration || Math.abs(currentTime - duration) < 0.01) {
          // Ensure the last frame is included
          if (keyframes.length === 0 || parseFloat(keyframes[keyframes.length - 1].time) < duration - 0.5) {
            const hdCanvas = document.createElement('canvas');
            hdCanvas.width = video.videoWidth;
            hdCanvas.height = video.videoHeight;
            const hdCtx = hdCanvas.getContext('2d');
            if (hdCtx) {
                video.currentTime = Math.max(0, duration - 0.1);
                await new Promise<void>(r => {
                  const timeout = setTimeout(() => r(), 200);
                  video.onseeked = () => {
                    clearTimeout(timeout);
                    hdCtx.drawImage(video, 0, 0);
                    const lastTime = Math.max(0, duration - 0.1);
                    keyframes.push({
                      time: lastTime.toFixed(2),
                      image: hdCanvas.toDataURL('image/jpeg', 0.8)
                    });
                    r();
                  };
                });
            }
          }
          resolve(keyframes.map(kf => ({ time: parseFloat(kf.time), url: kf.image })));
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frameData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

        if (prevData) {
          let diff = 0;
          // Calculate pixel difference (Manhattan distance)
          // Sampling every pixel might be slow, doing every 4th pixel or so is possible but here we do full
          // The original code does i+=4 which is correct for RGBA (checking R, G, B components)
          for (let i = 0; i < frameData.length; i += 4) {
            diff += Math.abs(frameData[i] - prevData[i]) +
              Math.abs(frameData[i + 1] - prevData[i + 1]) +
              Math.abs(frameData[i + 2] - prevData[i + 2]);
          }
          const avgDiff = diff / (frameData.length / 4 * 3);

          if (avgDiff > threshold) {
            const hdCanvas = document.createElement('canvas');
            hdCanvas.width = video.videoWidth;
            hdCanvas.height = video.videoHeight;
            const hdCtx = hdCanvas.getContext('2d');
            if (hdCtx) {
                hdCtx.drawImage(video, 0, 0);
                const dataUrl = hdCanvas.toDataURL('image/jpeg', 0.8);
    
                // Ensure using actual currentTime
                const captureTime = video.currentTime;
                keyframes.push({
                  time: captureTime.toFixed(2),
                  image: dataUrl
                });
                prevData = null; // Reset prevData to trigger new reference frame
            }
          } else {
            prevData = frameData;
          }
        } else {
          // First frame, record it
          prevData = frameData;
          const currentTime = video.currentTime;
          const hdCanvas = document.createElement('canvas');
          hdCanvas.width = video.videoWidth;
          hdCanvas.height = video.videoHeight;
          const hdCtx = hdCanvas.getContext('2d');
          if (hdCtx) {
              hdCtx.drawImage(video, 0, 0);
              keyframes.push({
                time: currentTime.toFixed(2),
                image: hdCanvas.toDataURL('image/jpeg', 0.8)
              });
          }
        }

        // Move to next sample point
        const nextTime = video.currentTime + (1 / sampleRate);
        if (nextTime >= duration) {
            // Handle end of video same as above
             if (keyframes.length === 0 || parseFloat(keyframes[keyframes.length - 1].time) < duration - 0.5) {
                const hdCanvas = document.createElement('canvas');
                hdCanvas.width = video.videoWidth;
                hdCanvas.height = video.videoHeight;
                const hdCtx = hdCanvas.getContext('2d');
                if (hdCtx) {
                    video.currentTime = Math.max(0, duration - 0.1);
                    await new Promise<void>(r => {
                        const timeout = setTimeout(() => r(), 200);
                        video.onseeked = () => {
                            clearTimeout(timeout);
                            hdCtx.drawImage(video, 0, 0);
                            const lastTime = Math.max(0, duration - 0.1);
                            keyframes.push({
                                time: lastTime.toFixed(2),
                                image: hdCanvas.toDataURL('image/jpeg', 0.8)
                            });
                            r();
                        };
                    });
                }
            }
            resolve(keyframes.map(kf => ({ time: parseFloat(kf.time), url: kf.image })));
            return;
        }
        
        video.currentTime = nextTime;
        await new Promise<void>(r => {
          const timeout = setTimeout(() => r(), 200); // Timeout protection
          video.onseeked = () => {
            clearTimeout(timeout);
            r();
          };
        });
        scan();
      };

      scan();
    };

    video.onerror = () => reject(new Error("Video load failed, check format or CORS settings"));
  });
};

/**
 * Extract keyframes at fixed intervals (FPS).
 * @param videoUrl 
 * @param options { fps: number }
 */
export const extractKeyFrames = async (_videoUrl: string, _options: { fps: number } = { fps: 1 }): Promise<{ time: number; url: string }[]> => {
    // Implementation similar to above but fixed interval without diff check
    // For now returning empty or we can implement if needed
    return []; 
}

export function BackgroundVideo() {
  return (
    <>
      {/* 1. HTML5 FIXED BACKGROUND VIDEO */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed inset-0 -z-10 object-cover w-full h-full pointer-events-none select-none"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -10,
          objectFit: 'cover',
          width: '100%',
          height: '100%',
        }}
      >
        <source src="/background.mp4" type="video/mp4" />
        <source src="/wallpaper.mp4" type="video/mp4" />
        <source src="/Copy%20Of%20Animated%20Dots.mp4" type="video/mp4" />
      </video>

      {/* 2. READABILITY & CONTRAST DARK OVERLAY */}
      <div
        className="fixed inset-0 -z-10 bg-black/60 backdrop-blur-[2px] pointer-events-none select-none"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -10,
        }}
        aria-hidden="true"
      />
    </>
  );
}

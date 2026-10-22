/**
 * Splash screen — a SERVER component, so it is present in the very first
 * HTML the browser paints. The previous version mounted from an effect,
 * which is why the page flashed into view before the splash covered it.
 *
 * How it clears itself, in order of reliability:
 *   1. A blocking inline script runs before first paint. On a repeat visit
 *      it adds `splash--skip` (display:none) so the splash never shows at
 *      all — no flash in either direction.
 *   2. A CSS animation fades it out after 1.8s. This works with JS off.
 *   3. A JS failsafe hides it at 3s in case animations never run.
 *
 * Reduced-motion users skip the splash entirely — see globals.css.
 */
export default function Splash() {
  const boot = `
(function () {
  var el = document.getElementById('vec-splash');
  if (!el) return;
  try {
    if (sessionStorage.getItem('vec-loaded') === '1') {
      el.className = 'splash splash--skip';
      return;
    }
    sessionStorage.setItem('vec-loaded', '1');
  } catch (e) { /* private mode: just play the splash */ }
  setTimeout(function () { el.className = 'splash splash--skip'; }, 3000);
})();`;

  return (
    <>
      <div id="vec-splash" className="splash" aria-hidden="true">
        <div className="splash-inner">
          {/* Same geometry as /logo.svg: E top, V left, C right, red bottom. */}
          <svg viewBox="0 0 120 120" className="splash-mark">
            <g transform="rotate(45 60 60)" fill="none" stroke="#0F3CE8" strokeWidth="2.6">
              <rect className="splash-cell" x="31" y="31" width="26" height="26" />
              <rect className="splash-cell" x="63" y="31" width="26" height="26" />
              <rect className="splash-cell" x="31" y="63" width="26" height="26" />
              <rect className="splash-cell" x="63" y="63" width="26" height="26"
                fill="#E1121B" stroke="none" />
            </g>
            <g fill="#E1121B" fontFamily="Arial, Helvetica, sans-serif"
               fontWeight="700" fontSize="17" textAnchor="middle">
              <text className="splash-cell" x="60" y="43">E</text>
              <text className="splash-cell" x="37" y="66">V</text>
              <text className="splash-cell" x="83" y="66">C</text>
            </g>
          </svg>

          <p className="splash-word">Vikram Engineering Co.</p>

          <div className="splash-rule">
            <span className="splash-bar" />
          </div>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: boot }} />
    </>
  );
}

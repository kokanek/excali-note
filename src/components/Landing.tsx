// Self hosted fonts (node modules), so /landing needs no third party request
// and paints the right face on first frame even behind a locked down network.
import '@fontsource/darker-grotesque/400.css';
import '@fontsource/darker-grotesque/500.css';
import '@fontsource/darker-grotesque/700.css';
import '@fontsource/darker-grotesque/800.css';
import '@fontsource/darker-grotesque/900.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/jetbrains-mono/700.css';

import './Landing.css';

const APP_URL = '/';
const GITHUB_URL = 'https://github.com/kokanek/excali-note';

type Feature = {
  n: string;
  pre: string;
  hl: string;
  hlType: 'blue' | 'yellow';
  post: string;
  body: string;
  img: string;
  alt: string;
  label: string;
  reverse: boolean;
};

const FEATURES: Feature[] = [
  {
    n: '01',
    pre: 'Create ',
    hl: 'multiple notebooks',
    hlType: 'blue',
    post: '',
    body: 'One home for every idea. Spin up a notebook for a project, a class, a doodle. Open it and pick up right where you left off.',
    img: '/landing/home.png',
    alt: 'ExcaliNote home screen showing a grid of notebooks',
    label: 'Your notebooks',
    reverse: false,
  },
  {
    n: '02',
    pre: 'Many pages in ',
    hl: 'one notebook',
    hlType: 'yellow',
    post: '',
    body: 'Add a page and keep drawing. Reorder them, flip between them from the sidebar. A whiteboard that remembers the whole story.',
    img: '/landing/notebook.png',
    alt: 'A notebook open in the editor with a page sidebar',
    label: 'Page 1 / 2',
    reverse: true,
  },
  {
    n: '03',
    pre: 'Download a page in ',
    hl: 'one click',
    hlType: 'blue',
    post: '',
    body: 'Grab a crisp PNG of any page. Drop it in a doc, a slide, a message. No export dialog, no fuss.',
    img: '/landing/download.png',
    alt: 'The download page button in the editor control rail',
    label: 'Download page',
    reverse: false,
  },
  {
    n: '04',
    pre: 'Present ',
    hl: 'full screen',
    hlType: 'yellow',
    post: '',
    body: 'Hit play and your pages go big. Arrow keys walk through them. Your notebook becomes the deck.',
    img: '/landing/presentation.png',
    alt: 'A page shown full screen in presentation mode',
    label: 'Presenting',
    reverse: true,
  },
];

function BrowserFrame({ img, alt, label }: { img: string; alt: string; label: string }) {
  return (
    <div className="ln-frame">
      <div className="ln-frame-bar">
        <span className="ln-dot red" />
        <span className="ln-dot yellow" />
        <span className="ln-dot green" />
        <span className="ln-frame-label">{label}</span>
      </div>
      <img src={img} alt={alt} loading="lazy" />
    </div>
  );
}

export function Landing() {
  return (
    <div className="ln">
      <header className="ln-header">
        <a className="ln-brand" href={APP_URL}>
          <img src="/favicon.svg" alt="" />
          ExcaliNote
        </a>
        <nav className="ln-nav">
          <a className="ln-btn" href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a className="ln-btn ln-btn--blue" href={APP_URL}>
            Open the app
          </a>
        </nav>
      </header>

      <section className="ln-hero">
        <span className="ln-kicker">Make a note. Flip the page. Keep going.</span>
        <h1 className="ln-wordmark">
          Excali<span className="accent">Note</span>
        </h1>
        <p className="ln-punch">The Excalidraw we all love, but as pages in a notebook.</p>
        <div className="ln-hero-cta">
          <a className="ln-btn ln-btn--blue ln-btn--lg" href={APP_URL}>
            Start a notebook
          </a>
          <a className="ln-btn ln-btn--yellow ln-btn--lg" href="#features">
            See how it works
          </a>
        </div>
        <div className="ln-scroll-cue ln-mono">Scroll to peek inside &darr;</div>
      </section>

      <div id="features">
        {FEATURES.map((f) => (
          <section className="ln-section" key={f.n}>
            <div className={`ln-feature${f.reverse ? ' reverse' : ''}`}>
              <div className="ln-feature-copy">
                <span className="ln-badge">{f.n}</span>
                <h2 className="ln-feature-title">
                  {f.pre}
                  <span className={f.hlType === 'blue' ? 'ln-hl-blue' : 'ln-hl-yellow'}>
                    {f.hl}
                  </span>
                  {f.post}
                </h2>
                <p className="ln-feature-body">{f.body}</p>
              </div>
              <div className="ln-feature-visual">
                <BrowserFrame img={f.img} alt={f.alt} label={f.label} />
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="ln-closing">
        <div className="ln-closing-card">
          <h2>
            Open a page.
            <br />
            Start drawing.
          </h2>
          <p className="ln-closing-sub">Free. In your browser. Saved on your machine.</p>
          <a className="ln-btn ln-btn--yellow ln-btn--lg" href={APP_URL}>
            Open the app
          </a>
        </div>
      </section>

      <footer className="ln-footer">
        <div className="ln-footer-brand">
          <img src="/favicon.svg" alt="" />
          ExcaliNote
        </div>
        <span className="ln-footer-note">Built on Excalidraw</span>
      </footer>
    </div>
  );
}

export default Landing;

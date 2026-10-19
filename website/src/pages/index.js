import {useState} from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Heading from '@theme/Heading';
import Layout from '@theme/Layout';
import ThemedImage from '@theme/ThemedImage';
import packageWorkflow from '../../../docs/methodsmith-package-workflow.png';
import skillMap from '../../../docs/workflow-diagram.png';

const AUDIENCES = [
  {
    title: 'Clinical statistics',
    lead: 'Observational studies, trials and registries, from question to Table 1.',
    commands: [
      ['/method-question', 'PICO, FINER and a hypothesis'],
      ['/method-power', 'sample size and power, with a script'],
      ['/method-sap', 'claims linked to ICH E9(R1) estimands'],
      ['/method-cohort', 'reproducible cohort and waterfall counts'],
      ['/method-table1', 'traceable baseline-characteristics table'],
      ['/method-numbers', 'every reported number traced to the analysis'],
    ],
  },
  {
    title: 'Python and ML papers',
    lead: 'Prediction models and notebooks that survive peer review.',
    commands: [
      ['/method-model-choice', 'justify the model after the estimand'],
      ['/method-ml-track', 'data hashes, splits and metrics'],
      ['/method-verify', 'leakage, effect direction and PHI gate'],
      ['/method-model-card', 'calibration, fairness and limits'],
      ['/method-marimo', 'reactive, reproducible Python notebooks'],
      ['/method-figure', 'calibration, ROC and forest plots'],
    ],
  },
  {
    title: 'Meta-analysis',
    lead: 'Systematic reviews and pooled effects with every source cited.',
    commands: [
      ['/method-lit-search', 'PubMed, full text or authoritative sources'],
      ['/method-evidence-map', 'a source-backed evidence map'],
      ['/method-prereg', 'PROSPERO, OSF or ClinicalTrials.gov'],
      ['/method-meta-analysis', 'random effects, REML with Hartung-Knapp'],
      ['/method-checklist', 'PRISMA 2020 and its extensions'],
      ['/method-write', 'evidence-bound manuscript drafts'],
    ],
  },
];

const TRUST = [
  ['39 reporting standards', 'Reporting guidelines, appraisal tools and templates, including CONSORT, STROBE, PRISMA, TRIPOD+AI and TARGET, encoded with their official item IDs. A test enforces routing to the newest version of each guideline.', 'Check the guideline sources', '/docs/guideline-sources'],
  ['An explicit sensitive-data boundary', 'Claude Code’s pre-tool hook restricts data reads in schema-only mode and checks identifiers before external calls in every mode. Other agents rely on skill instructions. These safeguards are not a sandbox or a substitute for institutional approval.', 'Read the safeguards and their limits', '/docs/setup#sensitive-data-boundary'],
  ['55 specialist agents', 'Methods, causal inference, leakage, calibration, fairness and reproducibility reviewers are part of a broader team of research and workflow agents. Review findings are deduplicated and confidence-gated.', 'Explore the skills and agents', 'https://github.com/sajor2000/methodsmith/blob/main/plugins/methodsmith/README.md#agents'],
  ['Numbers traced to the analysis', 'Manuscripts, tables and abstracts cite a registry written by the analysis code. A fail-closed gate traces each number to its SAP output, script commit and source hash. It does not read numbers inside images.', 'See how number provenance works', 'https://github.com/sajor2000/methodsmith/blob/main/plugins/methodsmith/README.md#numbers-locked-to-raw-data'],
];

const LOOP = [
  ['Plan', 'Frame the question and approve the analysis plan.', 'Draft the SAP, assumptions and planned outputs.'],
  ['Work', 'Resolve decisions and authorize the analysis.', 'Execute approved tasks and track SAP outputs.'],
  ['Review', 'Judge findings and decide what needs to change.', 'Check methods, code, reporting and reproducibility.'],
  ['Compound', 'Choose which validated lessons to retain.', 'Document decisions for the next study.'],
];

const INSTALL_COMMAND = 'claude plugin install methodsmith --marketplace sajor2000/methodsmith';

export default function Home() {
  const demo = useBaseUrl('/brand/demo.svg');
  const demoPoster = useBaseUrl('/brand/demo-poster.png');
  const tour = useBaseUrl('/media/methodsmith-tour.mp4');
  const tourPoster = useBaseUrl('/media/methodsmith-tour-poster.jpg');
  const [copyStatus, setCopyStatus] = useState('');

  async function copyInstallCommand() {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      setCopyStatus('Install command copied.');
    } catch {
      setCopyStatus('Copy unavailable. Select the install command below to copy it.');
    }
  }

  return (
    <Layout
      title="Rigorous methods, from question to paper"
      description="Methodsmith is a plugin for Claude Code and Codex for rigorous research methods: clinical statistics, Python and ML papers, and meta-analysis.">
      <main>
        <header className="ms-hero container">
          <div className="ms-hero__text">
            <Heading as="h1">Rigorous methods, from question to paper.</Heading>
            <p className="ms-hero__lead">
              Give your coding agent the habits of a careful methods team.
              Plan the analysis, review the methods, and trace the results
              in R or Python. You keep the scientific decisions.
            </p>
            <p className="ms-hero__scope">
              A research plugin for Claude Code and Codex, with workflows
              for clinical statistics, machine learning and meta-analysis.
            </p>
            <div className="ms-actions">
              <Link className="ms-button ms-button--primary" to="/docs/setup">
                Set up Methodsmith
              </Link>
              <Link className="ms-button ms-button--quiet" to="#demo">
                See an example
              </Link>
            </div>
            <p className="ms-hero__note">Open source. MIT licensed. Your team stays accountable.</p>
          </div>
          <figure className="ms-terminal" aria-label="Getting started in Claude Code">
            <figcaption>
              <span>Start in Claude Code</span>
              <button type="button" className="ms-copy" onClick={copyInstallCommand}>
                Copy install command
              </button>
            </figcaption>
            <pre>
              <code>
                <span className="c"># install the plugin</span>
                {'\n'}{INSTALL_COMMAND}
                {'\n\n'}
                <span className="c"># in your project, inside Claude Code</span>
                {'\n'}<span className="p">&gt;</span> /methodsmith:method-setup
                {'\n'}<span className="p">&gt;</span> /methodsmith:method-workflow
                {'\n\n'}
                <span className="c"># then plan before any analysis runs</span>
                {'\n'}<span className="p">&gt;</span> /methodsmith:method-plan{'\n'}  a cohort study of 30-day mortality
              </code>
            </pre>
            <p className="ms-copy-status" role="status">{copyStatus}</p>
            <p>
              Requires Claude Code 2.1.292 or later.{' '}
              <Link to="/docs/setup">Other agents and managed laptops</Link>.
            </p>
          </figure>
        </header>

        <div className="ms-inventory container" aria-label="Included in Methodsmith">
          <p>67 skills, 55 specialist agents, 39 reporting standards.</p>
          <Link href="https://github.com/sajor2000/methodsmith/blob/main/plugins/methodsmith/README.md#skills">
            Browse the full toolkit
          </Link>
        </div>

        <section className="ms-section container" aria-labelledby="tour">
          <Heading as="h2" id="tour">
            Watch the 90-second tour
          </Heading>
          <p className="ms-section__lead">
            A researcher&apos;s questions, one scene each: which reporting
            guideline applies, where to start the literature, how to sharpen the
            question, the analysis plan, data checks in R or Python, figures and
            tables, and the first Results draft. You make every call.
          </p>
          <figure className="ms-figure">
            <video
              controls
              playsInline
              preload="none"
              poster={tourPoster}
              width="1920"
              height="1080"
              aria-describedby="tour-caption">
              <source src={tour} type="video/mp4" />
              <a href={tour}>Download the tour video (MP4)</a>.
            </video>
            <figcaption id="tour-caption">
              Silent, scripted illustration on synthetic data. Screens are
              mock-ups of the formats the skills define, not a recording of a
              live run.
            </figcaption>
          </figure>
        </section>

        <section className="ms-section container" aria-labelledby="decide">
          <Heading as="h2" id="decide">
            You decide. Methodsmith does the legwork.
          </Heading>
          <p className="ms-section__lead">
            Your team frames the question, approves the plan and judges the
            findings. Methodsmith drafts, runs and checks the work around those
            decisions. The plan, work, review and compound loop comes from
            Every&apos;s Compound Engineering.
          </p>
          <figure className="ms-figure ms-figure--diagram ms-figure--scroll">
            <ThemedImage
              sources={{
                light: useBaseUrl('/brand/human-loop-light.svg'),
                dark: useBaseUrl('/brand/human-loop-dark.svg'),
              }}
              width="1200"
              height="560"
              alt="Swimlane. You, the scientist, frame the question, approve the plan, judge the findings and sign off the result. Methodsmith drafts the SAP with /method-plan, runs the approved analysis with /method-work, reviews every step with /method-review, and records the lessons with /method-compound, which feed the next study's plan."
            />
          </figure>
          <ol className="ms-loop">
            {LOOP.map(([step, human, agent]) => (
              <li key={step}>
                <Heading as="h3">{step}</Heading>
                <p><strong>Your team</strong>{human}</p>
                <p><strong>Methodsmith</strong>{agent}</p>
              </li>
            ))}
          </ol>
          <p className="ms-loop__return">Validated lessons feed the next plan. Every study compounds.</p>
        </section>

        <section className="ms-section container" aria-labelledby="demo">
          <Heading as="h2" id="demo">
            See it on synthetic data
          </Heading>
          <p className="ms-section__lead">
            Find the next step, link a causal claim to its estimand, then review
            the analysis before anyone reads the results.
          </p>
          <figure className="ms-figure ms-figure--scroll">
            <picture>
              <source media="(prefers-reduced-motion: reduce)" srcSet={demoPoster} />
              <img
                src={demo}
                width="1200"
                height="615"
                loading="lazy"
                alt="Illustrative terminal output: workflow recommends method-sap; the SAP links a claim to an estimand and flags two unresolved decisions; review returns Not ready."
              />
            </picture>
            <figcaption>Scripted replay on synthetic data. Output abridged from the formats the skills define.</figcaption>
          </figure>
          <p className="ms-demo__summary">
            In this example, the plan has two unresolved decisions. Review
            returns <strong>Not ready</strong>, with findings for the researcher
            to resolve, not an automatic sign-off.
          </p>
        </section>

        <section className="ms-section container" aria-labelledby="audiences">
          <Heading as="h2" id="audiences">
            Built for three kinds of study
          </Heading>
          <p className="ms-section__lead">
            67 skills in total. These are the ones each kind of study reaches for first.
          </p>
          <div className="ms-audiences">
            {AUDIENCES.map(({title, lead, commands}) => (
              <div key={title}>
                <Heading as="h3">{title}</Heading>
                <p>{lead}</p>
                <ul className="ms-commands">
                  {commands.map(([command, what]) => (
                    <li key={command}>
                      <code>{command}</code>
                      <span>{what}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="ms-section container" aria-labelledby="trust">
          <Heading as="h2" id="trust">
            Why you can check its work
          </Heading>
          <p className="ms-section__lead">
            Methodsmith drafts and checks. The researcher decides, and stays
            accountable for every result.
          </p>
          <dl className="ms-trust">
            {TRUST.map(([term, text, label, href]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>
                  <p>{text}</p>
                  <Link to={href}>{label}</Link>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="ms-section container" aria-labelledby="map">
          <Heading as="h2" id="map">
            The skill map
          </Heading>
          <p className="ms-section__lead">
            Thirty of the 67 skills, in the order a study meets them, with the
            guardrails that apply at every step.
          </p>
          <details className="ms-disclosure">
            <summary>View the study lifecycle map</summary>
            <figure className="ms-figure">
              <img
                src={skillMap}
                loading="lazy"
                alt="Skill map across Frame, Design, Data, Plan, Execute and Review. The skill lists above provide text descriptions; the diagram gives an overview, not proof of enforcement."
              />
            </figure>
          </details>
        </section>

        <section className="ms-section container" aria-labelledby="start">
          <Heading as="h2" id="start">
            Install once, set up each project
          </Heading>
          <p className="ms-section__lead">
            Start with Claude Code or Codex. The setup guide also covers Pi,
            OpenCode, Gemini CLI, Kiro, Qwen Code and approved offline installs.
            Then open your study folder and run setup for that project.
          </p>
          <div className="ms-actions">
            <Link className="ms-button ms-button--primary" to="/docs/setup">
              Choose your install route
            </Link>
            <Link className="ms-button ms-button--quiet" href="https://github.com/sajor2000/methodsmith">
              View the source on GitHub
            </Link>
          </div>
          <details className="ms-disclosure">
            <summary>View the installation workflow</summary>
            <figure className="ms-figure">
              <img
                src={packageWorkflow}
                loading="lazy"
                alt="Install the plugin, run method-setup in the project, then use method-workflow to choose the next skill."
              />
            </figure>
          </details>
        </section>

        <section className="ms-section container" aria-labelledby="credits">
          <Heading as="h2" id="credits">
            Credits
          </Heading>
          <p className="ms-credit">
            Methodsmith is a fork of{' '}
            <Link href="https://github.com/EveryInc/compound-engineering-plugin">Compound Engineering</Link>{' '}
            by Kieran Klaassen and Every, which introduced the plan, work, review,
            compound loop for software. Methodsmith adapts it for research methods
            and is maintained by Juan Carlos Rojas. MIT licensed.
          </p>
        </section>
      </main>
    </Layout>
  );
}

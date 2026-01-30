# Checkpoint Courier

A gamified behavioral economics research instrument for studying how institutional factors—specifically bureaucratic complexity and enforcement patterns—drive corruption. Players experience a delivery game while unknowingly participating in a 2x2 experimental design testing the hypothesis: *"When compliance is difficult and enforcement is predatory, bribery becomes the dominant equilibrium."*

---

## Table of Contents

1. [Research Motivation](#research-motivation)
2. [Theoretical Framework](#theoretical-framework)
3. [Experimental Design](#experimental-design)
4. [Game Mechanics](#game-mechanics)
5. [Technical Architecture](#technical-architecture)
6. [Deployment Guide](#deployment-guide)
7. [Data Collection & Privacy](#data-collection--privacy)
8. [For Researchers](#for-researchers)
9. [License](#license)

---

## Research Motivation

### The Real-World Phenomenon

This project was inspired by observations of governance and corruption dynamics in Vietnam:

> *The nature of the Vietnamese communist party's bureaucracy meant that it was very difficult for the average Vietnamese citizen to get a driver's license, although most Vietnamese people owned a motorbike—often their most valuable asset. Speed limits were officially much lower than most people typically drove. Occasionally local police would do enforcement "blitzes," stopping drivers for speeding when they were just going the speed of surrounding traffic. Usually when these drivers got pulled over, they were unable to present a valid driver's license. Because the police officers themselves were underpaid, they would often solicit and accept bribes from drivers who were pulled over for speeding and licensing infractions. Drivers who were unable or unwilling to pay bribes would have their motorbikes confiscated. Because of the bureaucracy, these motorbikes were usually impossible for a local Vietnamese citizen to get out of impoundment, meaning that their most valuable asset could be taken by the government, seemingly arbitrarily.*

This phenomenon illustrates how **arbitrary, capricious, and harsh punishments can contribute to distrust and self-preservation amongst the general populace**, particularly among the most vulnerable. This distrust and orientation toward self-preservation in turn can lead to further corruption and selfish behavior, creating a **vicious cycle**.

### Research Questions

1. Does bureaucratic complexity ("red tape") increase the likelihood that individuals resort to bribery?
2. Does frequent, predatory enforcement normalize corrupt transactions?
3. How do these factors interact? Does the combination of high bureaucracy AND frequent enforcement create a "corruption trap"?
4. Can we observe these dynamics in revealed preferences (actual choices) rather than just survey responses?

---

## Theoretical Framework

### Literature Foundation

This instrument draws on several strands of experimental economics and political economy research:

**Corruption and Bribery Experiments**
- Abbink, Irlenbusch & Renner (2002) developed experimental bribery games capturing citizen-official dynamics
- Basu (2011) theorized "harassment bribes" and asymmetric punishment policies
- Corrado et al. (2025) found that when corruption is assumed to be common, individuals are more likely to offer bribes

**Trust in Institutions and Social Capital**
- Rothstein & Eek (2009) demonstrated that trust in authorities ("vertical trust") significantly influences trust in other people ("social trust")
- You (2018) documented vicious circles between low trust and rampant corruption

**Punishment, Cooperation, and Governance Norms**
- Herrmann et al. (2008) found that weak rule-of-law environments exhibit more antisocial punishment behavior
- Dasgupta & Radoniqi (2023) showed that doubts about enforcement integrity dramatically reduce deterrent effects

### The Hypothesis Being Tested

**Hypothesis 2** (from the theoretical framework):

> *In an environment where following the law is onerous or nearly impossible for average people (for example, driver's licenses that most cannot obtain), individuals will resort to bribery or rule-bending as a rational survival strategy. This in turn normalizes corruption and reinforces distrust in authorities.*

This game operationalizes this hypothesis by manipulating:
1. **Bureaucratic complexity** (how hard it is to obtain permits)
2. **Enforcement frequency** (how often checkpoints have officers present)

---

## Experimental Design

### Treatment Conditions (2x2 Factorial)

Players are deterministically assigned to one of four conditions based on a SHA-256 hash of their player UUID:

| Treatment Code | Name | Bureaucracy | Enforcement | Description |
|----------------|------|-------------|-------------|-------------|
| **LR** | Control | Low (2 steps) | Standard | Baseline condition |
| **HR** | Red Tape | High (5-8 steps) | Standard | Tests bureaucracy effect |
| **LF** | Extortion | Low | Frequent + Blitz | Tests enforcement effect |
| **HF** | The Squeeze | High | Frequent + Blitz | Tests interaction effect |

### Treatment Assignment

```javascript
// Deterministic assignment via SHA-256 hash
const hash = await crypto.subtle.digest('SHA-256', playerUUID);
const bytes = new Uint8Array(hash);
const bureaucracyBit = bytes[0] % 2;  // 0 = Low, 1 = High
const enforcementBit = bytes[1] % 2;  // 0 = Rare, 1 = Frequent
```

This ensures:
- Same player always gets same treatment (stable across sessions)
- Assignment is not predictable or reversible
- Approximately equal distribution across conditions

### Dependent Variables

**Primary measures:**
- Bribe offer rate (% of encounters where player offers bribe)
- Bribe amount offered (relative to expected/suggested)
- Compliance rate (% of encounters with valid permit)
- Permit acquisition rate (% of players who complete permit process)

**Secondary measures:**
- Response time (decision latency in milliseconds)
- Heat accumulation (reputation/suspicion level)
- Risk-taking behavior (speed choices, flee attempts)
- Session completion rate (abandonment vs. completion)

---

## Game Mechanics

### Core Loop

1. **Select Contract**: Choose a delivery with varying difficulty, checkpoints, and rewards
2. **Driving Phase**: Navigate a 2D road, avoiding obstacles (cones, oil slicks, rocks)
3. **Checkpoint Encounters**: At each checkpoint, encounter an officer and choose an action
4. **Negotiation**: Based on your papers and the officer's personality, resolve the encounter
5. **Completion**: Earn rewards or face impoundment

### Checkpoint Negotiation System

When stopped at a checkpoint, players face a timed decision with these options:

| Action | Risk | Cost | Best When |
|--------|------|------|-----------|
| **Show Permit** | None | Permit cost | You have valid papers |
| **Offer Bribe** | Medium | Variable | Officer is corruptible |
| **Argue** | Medium | Time | Officer is lenient |
| **Bluff** | High | None | You're convincing |
| **Flee** | Very High | Speed penalty | You're desperate |
| **Comply** | None | Fine amount | Accept the penalty |

### Officer Personality System

Officers have distinct personalities affecting their behavior:

| Personality | Corruptibility | Strictness | Greed | Patience |
|-------------|---------------|------------|-------|----------|
| **By the Book** | 0.1 | 0.9 | 0.2 | 0.7 |
| **Pragmatic** | 0.5 | 0.5 | 0.4 | 0.6 |
| **Corrupt** | 0.9 | 0.3 | 0.8 | 0.4 |
| **Lazy** | 0.6 | 0.2 | 0.3 | 0.3 |
| **Zealot** | 0.0 | 1.0 | 0.1 | 0.8 |
| **Shakedown** | 0.95 | 0.4 | 0.9 | 0.5 |

### Permit System (Bureaucracy Manipulation)

**Low Bureaucracy (LR, LF):**
- 2 simple steps
- Clear requirements
- Reasonable processing time

**High Bureaucracy (HR, HF):**
- 5-8 complex steps
- Ambiguous requirements ("Form B-7 requires notarization")
- Random delays and rejections
- Permits expire, requiring renewal

### Lives System

Players have 3 hearts (lives). Colliding with obstacles on the road costs 1 heart. At 0 hearts, the delivery is abandoned with no reward. This adds:
- Skill-based engagement (avoiding obstacles)
- Risk-reward tradeoffs (faster = more obstacle danger)
- Natural session endings (not just checkpoint failures)

---

## Technical Architecture

### Project Structure

```
checkpoint_courier_web/
├── index.html              # Main HTML structure
├── styles.css              # All styling (CSS variables, responsive)
├── README.md               # This file
├── DEPLOY.md               # Deployment guide
├── js/
│   ├── main.js             # Application entry point & UI
│   ├── models.js           # Data models, enums, treatment logic
│   ├── state.js            # Game state management (localStorage)
│   ├── officerAI.js        # Officer decision engine
│   ├── permits.js          # Permit/bureaucracy simulation
│   ├── game.js             # 2D driving game (Canvas, emoji graphics)
│   └── cloudUpload.js      # Data upload to Cloudflare Workers
└── worker/
    ├── index.js            # Cloudflare Worker (validation, storage)
    └── wrangler.toml       # Worker configuration
```

### Client-Side Principles

- **No PII Collection**: Player UUID is randomly generated, no names/emails required
- **Coarsened Timestamps**: Stored at minute-level to reduce fingerprinting
- **Local Persistence**: Game state saved to localStorage
- **Deterministic Treatment**: Same UUID always yields same experimental condition

### Data Flow

```
[Player Device]
      │
      ▼
[Game Logic (JS)] ──► [localStorage]
      │
      │ (session end)
      ▼
[Cloudflare Worker] ──► [R2 Storage]
      │
      │ (daily cron)
      ▼
[OSF Repository]
```

### Event Schema

Each uploaded session contains:

```json
{
  "playerId": "uuid-string",
  "treatmentCode": "HF",
  "timestamp": "2024-01-15T10:30:00Z",
  "appVersion": "1.0.0",
  "platform": "web",
  "session": {
    "id": "session-uuid",
    "deliveryId": "delivery-uuid",
    "treatment": "HF",
    "startTime": "...",
    "endTime": "...",
    "outcome": "completed|impounded|abandoned",
    "moneyBefore": 500,
    "moneyAfter": 650,
    "totalBribes": 75,
    "totalFines": 0,
    "encounters": [
      {
        "checkpointNumber": 1,
        "officerPersonality": "corrupt",
        "officerCorruptibility": 0.9,
        "playerAction": "bribe",
        "bribeOffered": 50,
        "bribeExpected": 45,
        "outcome": "accepted",
        "responseTimeMs": 3400,
        "hadPermit": false,
        "heatLevel": 0.2
      }
    ]
  }
}
```

---

## Deployment Guide

### Quick Start (Local Development)

```bash
# Serve with Python 3
python3 -m http.server 8000

# Or with Node.js
npx serve

# Open in browser
open http://localhost:8000
```

### Production Deployment (Cloudflare)

#### Step 1: Deploy Web App to Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Pages**
2. Click **"Create a project"** → **"Upload assets"**
3. Upload: `index.html`, `styles.css`, `js/` folder
4. Note your Pages URL (e.g., `https://checkpoint-courier.pages.dev`)

#### Step 2: Configure the Worker

1. Edit `worker/index.js`
2. Update `ALLOWED_ORIGINS` with your Pages domain
3. Deploy via Cloudflare Dashboard or Wrangler CLI:

```bash
cd worker
wrangler login
wrangler r2 bucket create checkpoint-courier-data
wrangler secret put APP_SECRET    # Enter your secret
wrangler secret put OSF_PAT       # OSF Personal Access Token
wrangler secret put OSF_NODE_ID   # OSF project node ID
wrangler deploy
```

### Debug Mode

Add `?debug=1` to the URL to show diagnostics panel with upload testing:
```
https://your-domain.pages.dev/?debug=1
```

---

## Data Collection & Privacy

### What We Collect

| Data Type | Purpose | Privacy Level |
|-----------|---------|---------------|
| Player UUID | Link sessions, assign treatment | Pseudonymous (random) |
| Treatment code | Experimental analysis | Non-identifying |
| Checkpoint decisions | Primary dependent variable | Non-identifying |
| Response times | Secondary measure | Non-identifying |
| Session metadata | Data quality | Non-identifying |

### What We DON'T Collect

- Names, emails, or any PII
- IP addresses (stripped server-side)
- Precise timestamps (coarsened to minutes)
- Device fingerprints
- Location data

### Data Validation (Worker-Side)

The Cloudflare Worker validates all uploads:
- **Origin authentication**: Only accepts requests from allowed domains
- **Payload size limit**: Max 50 KB
- **Schema validation**: Rejects malformed data
- **Value range checks**: Numeric fields clamped to valid ranges
- **Sanitization**: All strings stripped of special characters

---

## For Researchers

### Accessing the Data

Data will be made available through:

1. **OSF (Open Science Framework)**: Project landing page with documentation
2. **Harvard Dataverse or openICPSR**: Canonical dataset archive with DOI
3. **Zenodo**: Code releases and versioned data exports

### Data Dictionary

Full codebook available in the data repository, including:
- Variable definitions and types
- Treatment assignment algorithm
- Cleaning pipeline documentation
- Minimal reproducible analysis examples

### Suggested Analyses

**Primary Analysis:**
```
bribe_rate ~ bureaucracy * enforcement + (1|player_id)
```

**Secondary Analyses:**
- Permit acquisition survival curves by treatment
- Response time analysis (decision difficulty)
- Heat accumulation trajectories
- Session-level completion rates

### Citation

If you use this data in research, please cite:

```
[Citation forthcoming upon publication]
```

### Ethical Considerations

This instrument is designed for "in the wild" data collection without explicit experimental consent. Key ethical safeguards:

1. **No deception about data collection**: App store disclosures will note data collection
2. **Opt-in data donation**: Players can choose private mode
3. **No PII**: Truly anonymous participation possible
4. **Public benefit**: Data freely available to research community
5. **IRB-ready**: Design follows principles for minimal-risk behavioral research

---

## Browser Support

Works in all modern browsers with JavaScript module support:
- Chrome 61+
- Firefox 60+
- Safari 11+
- Edge 79+

---

## License

**Code**: MIT License

**Data**: CC0 (Public Domain) when published

**Research Use**: This instrument is freely available for academic research. Contact the author for commercial licensing inquiries.

---

## Acknowledgments

This project was conceptualized through conversations about governance, trust, and corruption dynamics observed in developing economies. It builds on decades of experimental economics research into corruption, public goods games, and institutional trust.

Special thanks to the researchers whose work informed this design, including Abbink, Basu, Herrmann, Rothstein, and many others working at the intersection of economics, political science, and game theory.

---

## References

- Abbink, K., Irlenbusch, B., & Renner, E. (2002). An experimental bribery game. *Journal of Law, Economics, and Organization*.
- Basu, K. (2011). Why, for a class of bribes, the act of giving a bribe should be treated as legal. *Ministry of Finance Working Paper*.
- Corrado, L., et al. (2025). Information and corruption: Experimental evidence from a public goods game.
- Dasgupta, I., & Radoniqi, F. (2023). Trust in legal institutions and deterrence of corruption.
- Herrmann, B., Thöni, C., & Gächter, S. (2008). Antisocial punishment across societies. *Science*.
- Rothstein, B., & Eek, D. (2009). Political corruption and social trust. *Rationality and Society*.
- You, J. (2018). Trust and corruption. In *The Oxford Handbook of Social and Political Trust*.

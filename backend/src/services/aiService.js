import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ override: true });

const GROQ_API_KEY = process.env.GROQ_API_KEY;

/**
 * Generate AI-powered review and insights for a GitHub profile using Groq Llama3
 * @param {Object} profile - Full computed insights object of the developer
 * @returns {Promise<Object>} Object containing persona, summary, strengths, weaknesses, standout_factors, and career_path
 */
export const generateAIAnalysis = async (profile) => {
  if (!GROQ_API_KEY) {
    console.warn('[AI WARNING] GROQ_API_KEY is not defined. Using fallback AI generator.');
    return getFallbackAnalysis(profile);
  }

  try {
    const prompt = `
You are a highly experienced Tech Recruiter and Senior Developer Advocate.
Analyze the following developer profile stats and generate a structured developer review.

Developer Stats:
- Username: @${profile.username}
- Name: ${profile.name || 'Anonymous'}
- Bio: ${profile.bio || 'None'}
- Developer Tier: ${profile.developer_tier} (Score: ${profile.developer_score}/100)
- Followers: ${profile.followers} (Ratio: ${profile.followers > 0 && profile.following > 0 ? (profile.followers / profile.following).toFixed(1) : '0'}x)
- Public Repos: ${profile.public_repos} (${profile.original_repo_count} original, ${profile.forked_repo_count} forks)
- Total Stars: ${profile.total_stars} (Avg: ${profile.avg_stars_per_repo}/repo)
- Primary Language: ${profile.primary_language || 'None'}
- Language Diversity: ${profile.language_diversity_index} languages
- Top Topics: ${(profile.top_topics || []).join(', ') || 'None'}
- Open Source Impact Score: ${profile.open_source_impact} (stars + forks + watchers)
- Recent Activity (30 days): ${profile.recent_events_count} events (${profile.recent_push_count} pushes, ${profile.recent_pr_count} PRs, ${profile.recent_issue_count} issues)
- Has Profile README: ${profile.has_readme_profile ? 'Yes' : 'No'}
- Profile Completeness: ${profile.profile_completeness_score}/100

Please respond in valid, raw JSON format matching this schema:
{
  "persona": "An inspiring, highly descriptive 2-4 word developer archetype (e.g. 'Meticulous Systems Architect', 'Vibrant UI/UX Craftsman', 'Prolific Open Source Pathfinder')",
  "summary": "A concise 2-sentence summary outlining what they bring to the table and their core focus.",
  "strengths": ["Strength 1 (specific to their stats)", "Strength 2", "Strength 3"],
  "weaknesses": ["Area of improvement 1", "Area of improvement 2"],
  "standout_factors": ["Point of distinction 1 (what makes them standout from standard developers)", "Point of distinction 2"],
  "career_path": ["Recommended role 1 (e.g. DevOps Engineer, Technical Lead, Frontend Dev)", "Recommended role 2"]
}
Do not include any additional markdown, backticks, or text before/after the JSON. Just return the raw JSON object.
`;

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are an expert AI coding reviewer. Always reply with raw, valid JSON matching the requested schema.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10s timeout
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (content) {
      return JSON.parse(content);
    }
    throw new Error('Empty response from Groq');
  } catch (error) {
    console.error('[AI ERROR] Groq analysis failed:', error.message);
    return getFallbackAnalysis(profile);
  }
};

/**
 * Robust rule-based fallback analyzer when Groq is unavailable
 */
function getFallbackAnalysis(profile) {
  const language = profile.primary_language || 'JavaScript/TypeScript';
  const tier = profile.developer_tier;

  let persona = 'Pragmatic Software Engineer';
  let summary = `A dedicated developer focusing primarily on ${language}. They possess a solid baseline of GitHub engagement and code creation.`;
  const strengths = [];
  const weaknesses = [];
  const standout_factors = [];
  const career_path = [];

  // Persona & summary based on tier/language
  if (tier === 'Legend') {
    persona = `Elite ${language} Evangelist`;
    summary = `An exceptional, world-class software leader specialized in ${language}. Their code has deep open-source resonance, high-leverage projects, and stellar peer standing.`;
  } else if (tier === 'Elite') {
    persona = `Masterful ${language} Architect`;
    summary = `A highly seasoned developer with strong architectural instincts in ${language}. They display a remarkable portfolio of original repositories and robust community engagement.`;
  } else if (tier === 'Senior') {
    persona = `Dependable ${language} Engineer`;
    summary = `A productive senior software developer with broad capabilities in ${language}. They consistently deliver structured code with stable operational coverage.`;
  } else if (tier === 'Rising') {
    persona = `Agile ${language} Generalist`;
    summary = `An emerging engineering talent showing highly positive momentum in ${language}. They are actively growing their technical expertise and open source presence.`;
  } else {
    persona = `Aspiring ${language} Enthusiast`;
    summary = `A developing software builder exploring ${language}. They are currently laying down their foundations and expanding their personal project collection.`;
  }

  // Strengths
  if (profile.total_stars > 100) {
    strengths.push(`Strong open-source validation with a total of ${profile.total_stars} stars received.`);
  } else {
    strengths.push(`Focused repository creator with ${profile.original_repo_count} original codebases.`);
  }

  if (profile.language_diversity_index > 5) {
    strengths.push(`Remarkable versatility, commanding a range of ${profile.language_diversity_index} distinct technologies.`);
  } else {
    strengths.push(`Deep focus and execution competency within the ${language} ecosystem.`);
  }

  if (profile.recent_events_count > 10) {
    strengths.push(`Excellent developmental momentum, with ${profile.recent_events_count} active contributions in the last month.`);
  } else {
    strengths.push(`Complete repository documentation showing a high percentage of project descriptions.`);
  }

  // Weaknesses
  if (!profile.has_readme_profile) {
    weaknesses.push('Lacks a custom GitHub Profile README which hurts personal branding.');
  }
  if (profile.repos_with_description_pct < 60) {
    weaknesses.push('Multiple repositories are missing structural descriptions or summaries.');
  }
  if (profile.recent_events_count === 0) {
    weaknesses.push('Dormant operational activity with no contributions recorded over the past 30 days.');
  }
  if (weaknesses.length < 2) {
    weaknesses.push('High dependency on a single programming language; could diversify tech stack.');
  }

  // Standout factors
  if (profile.developer_score >= 70) {
    standout_factors.push(`Belongs to the upper echelon of developers with a score of ${profile.developer_score}/100.`);
  }
  if (profile.followers > 100) {
    standout_factors.push(`Cultivated a substantial social reach of ${profile.followers} community followers.`);
  }
  if (profile.open_source_impact > 500) {
    standout_factors.push(`Substantial public ecosystem impact with ${profile.open_source_impact} total developer interactions.`);
  }
  if (standout_factors.length === 0) {
    standout_factors.push(`Well-structured profile with ${profile.profile_completeness_score}% metadata completeness.`);
    standout_factors.push(`Demonstrated hands-on experience maintaining original code repository assets.`);
  }

  // Career path
  if (profile.primary_language === 'HTML' || profile.primary_language === 'CSS' || profile.primary_language === 'TypeScript') {
    career_path.push('Frontend Engineering Lead');
    career_path.push('Full-Stack Web Architect');
  } else if (profile.primary_language === 'Python' || profile.primary_language === 'Go' || profile.primary_language === 'Rust') {
    career_path.push('Backend Infrastructure Engineer');
    career_path.push('Distributed Systems Specialist');
  } else {
    career_path.push('Full-Stack Software Engineer');
    career_path.push('Open Source System Designer');
  }

  return {
    persona,
    summary,
    strengths: strengths.slice(0, 3),
    weaknesses: weaknesses.slice(0, 2),
    standout_factors: standout_factors.slice(0, 2),
    career_path: career_path.slice(0, 2),
  };
}

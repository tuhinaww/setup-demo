require("dotenv").config();
const axios = require("axios");
const { getPullRequestFiles, getDiffSummary, getPullRequestDiffForFile } = require("./services/githubService");

const { GITHUB_TOKEN } = process.env;

const githubApi = axios.create({
  baseURL: "https://api.github.com",
  headers: {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github.v3+json",
  },
});

console.log("should not work for main and production branch");

const ALLOWED_BRANCHES = ['staging', 'main'];

const postComment = async (owner, repo, pullNumber, file, summary) => {
  try {
    const response = await githubApi.post(`/repos/${owner}/${repo}/issues/${pullNumber}/comments`, {
      body: `### Summary of changes in ${file}:\n\n${summary}`,
    });

    console.log(`Comment posted for ${file}: ${response.data.html_url}`);
  } catch (error) {
    console.error(`Error posting comment for ${file}:`, error.response?.data || error.message);
  }
};

const shouldProcessPR = async (owner, repo, pullNumber) => {
  try {
    const response = await githubApi.get(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
    const targetBranch = response.data.base.ref;
    
    return ALLOWED_BRANCHES.includes(targetBranch);
  } catch (error) {
    console.error("Error checking PR target branch:", error.response?.data || error.message);
    return false;
  }
};

const run = async () => {
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
  const pullNumber = process.env.PR_NUMBER;

  try {
    const shouldProcess = await shouldProcessPR(owner, repo, pullNumber);
    
    if (!shouldProcess) {
      console.log("Skipping PR summary - target branch is not in the allowed list");
      return;
    }

    const files = await getPullRequestFiles(owner, repo, pullNumber);

    for (const file of files) {
      const diff = await getPullRequestDiffForFile(owner, repo, pullNumber, file);
      const summary = await getDiffSummary(diff, file);
      await postComment(owner, repo, pullNumber, file, summary);
    }
  } catch (error) {
    console.error("Error processing PR:", error);
    process.exit(1);
  }
};

run();

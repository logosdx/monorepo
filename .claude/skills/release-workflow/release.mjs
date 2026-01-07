#!/usr/bin/env zx

import 'zx/globals';

$.verbose = false;

const log = {
    info: (msg) => console.log(chalk.cyan(`→ ${msg}`)),
    success: (msg) => console.log(chalk.green(`✓ ${msg}`)),
    warn: (msg) => console.log(chalk.yellow(`⚠ ${msg}`)),
    error: (msg) => console.log(chalk.red(`✗ ${msg}`)),
    step: (num, msg) => console.log(chalk.blue(`\n[${num}] ${msg}`)),
};

const PROTECTED_BRANCHES = ['master', 'main', 'release'];

/**
 * Get current git branch
 */
const getCurrentBranch = async () => {

    const { stdout } = await $`git branch --show-current`;
    return stdout.trim();
};

/**
 * Check if on a protected branch
 */
const isProtectedBranch = (branch) => {

    return PROTECTED_BRANCHES.includes(branch);
};

/**
 * Get the latest CI run ID for a branch
 */
const getLatestRunId = async (branch) => {

    const { stdout } = await $`gh run list --branch ${branch} --limit 1 --json databaseId -q '.[0].databaseId'`;
    return stdout.trim();
};

/**
 * Wait for a CI run to complete
 */
const waitForCI = async (runId) => {

    log.info(`Waiting for CI run ${runId}...`);

    try {

        await $`gh run watch ${runId} --exit-status`;
        log.success('CI passed');
        return true;
    }
    catch (err) {

        log.error('CI failed');
        await $`gh run view ${runId} --log-failed`.pipe(process.stderr);
        return false;
    }
};

/**
 * Find the Version Packages PR
 */
const findVersionPR = async (maxAttempts = 10) => {

    log.info('Waiting for Version Packages PR...');

    for (let i = 0; i < maxAttempts; i++) {

        await sleep(3000);

        const { stdout } = await $`gh pr list --state open --search "Version Packages" --json number -q '.[0].number'`;
        const prNum = stdout.trim();

        if (prNum) {

            log.success(`Found Version Packages PR #${prNum}`);
            return prNum;
        }

        log.info(`Attempt ${i + 1}/${maxAttempts}...`);
    }

    return null;
};

/**
 * Main release workflow
 */
const main = async () => {

    console.log(chalk.bold.magenta('\n🚀 Release Workflow\n'));

    // Step 1: Verify branch
    log.step(1, 'Verifying branch');
    const branch = await getCurrentBranch();

    if (isProtectedBranch(branch)) {

        log.error(`Cannot run release workflow from protected branch: ${branch}`);
        log.info('Create a feature branch first: git checkout -b feat/your-feature');
        process.exit(1);
    }

    log.success(`On feature branch: ${branch}`);

    // Step 2: Check for uncommitted changes
    log.step(2, 'Checking for uncommitted changes');
    const { stdout: status } = await $`git status --porcelain`;

    if (status.trim()) {

        log.warn('You have uncommitted changes:');
        console.log(status);
        log.info('Please commit or stash changes before running release workflow');
        log.info('Use /changeset-writer and /git-committer skills first');
        process.exit(1);
    }

    log.success('Working directory clean');

    // Step 3: Push and create PR
    log.step(3, 'Pushing branch and creating PR');

    try {

        await $`git push -u origin ${branch}`;
        log.success('Branch pushed');
    }
    catch (err) {

        log.error('Failed to push branch');
        throw err;
    }

    // Check if PR already exists
    const { stdout: existingPR } = await $`gh pr list --head ${branch} --json number -q '.[0].number'`;

    let prNumber;

    if (existingPR.trim()) {

        prNumber = existingPR.trim();
        log.info(`PR #${prNumber} already exists`);
    }
    else {

        const { stdout: prUrl } = await $`gh pr create --base master --fill`;
        prNumber = prUrl.trim().split('/').pop();
        log.success(`Created PR #${prNumber}`);
    }

    // Step 4: Wait for CI on feature PR
    log.step(4, 'Waiting for CI on feature PR');
    await sleep(5000); // Give CI time to start

    const runId = await getLatestRunId(branch);

    if (!runId) {

        log.error('Could not find CI run');
        process.exit(1);
    }

    const ciPassed = await waitForCI(runId);

    if (!ciPassed) {

        log.error('CI failed. Fix issues and push again.');
        process.exit(1);
    }

    // Step 5: Merge feature PR
    log.step(5, 'Merging feature PR');

    await $`gh pr merge ${prNumber} --squash --delete-branch`;
    log.success('Feature PR merged');

    // Switch to master and pull
    await $`git checkout master`;
    await $`git pull origin master`;
    log.success('Switched to master and pulled');

    // Step 6: Wait for Version Packages PR
    log.step(6, 'Waiting for Version Packages PR');

    const versionPRNumber = await findVersionPR();

    if (!versionPRNumber) {

        log.error('Version Packages PR not found after 30 seconds');
        log.info('Check if changesets exist and CI completed successfully');
        process.exit(1);
    }

    // Step 7: Merge Version Packages PR
    log.step(7, 'Merging Version Packages PR');

    await $`gh pr merge ${versionPRNumber} --squash --delete-branch`;
    log.success('Version Packages PR merged');

    await $`git pull origin master`;
    log.success('Pulled version changes');

    // Step 8: Merge to release branch
    log.step(8, 'Merging master to release branch');

    await $`git checkout release`;
    await $`git merge master`;
    await $`git push origin release`;
    log.success('Pushed to release branch');

    // Step 9: Wait for publish
    log.step(9, 'Waiting for publish workflow');
    await sleep(5000);

    const publishRunId = await getLatestRunId('release');

    if (publishRunId) {

        const publishPassed = await waitForCI(publishRunId);

        if (!publishPassed) {

            log.error('Publish failed. Check logs and retry.');
            process.exit(1);
        }
    }

    // Switch back to master
    await $`git checkout master`;

    console.log(chalk.bold.green('\n✅ Release workflow complete!\n'));
    log.info('Packages have been published to npm');
};

main().catch((err) => {

    log.error(`Workflow failed: ${err.message}`);
    process.exit(1);
});

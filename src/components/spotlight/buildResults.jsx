import { collectServerEntries, fuzzyScore } from "./Spotlight";

export function buildResults(query) {
    const entries = collectServerEntries();
    const serverResults = [];
    const channelResults = [];

    for (const entry of entries) {
        const serverLabel = entry?.name || entry?.src;
        const serverScore = serverLabel ? fuzzyScore(query, serverLabel) : -1;
        if (serverScore !== -1) {
            serverResults.push({
                kind: "server",
                key: `server:${entry.src}`,
                score: serverScore,
                server: entry
            });
        }

        const channels = entry.connection?.state?.channels ?? [];
        for (const channel of channels) {
            if (!channel) continue;

            const displayLabel = channel.display_name;
            const nameLabel = channel.name;

            const displayScore = displayLabel ? fuzzyScore(query, displayLabel) : -1;
            const nameScore = nameLabel ? fuzzyScore(query, nameLabel) : -1;

            const candidates = [displayScore, nameScore].filter((s) => s !== -1);
            if (candidates.length === 0) continue;

            const score = Math.min(...candidates);
            const label = displayLabel || nameLabel;

            channelResults.push({
                kind: "channel",
                key: `channel:${entry.src}:${channel.name}`,
                score,
                server: entry,
                channel
            });
        }
    }

    serverResults.sort((a, b) => a.score - b.score);
    channelResults.sort((a, b) => a.score - b.score);

    return { serverResults, channelResults };
}

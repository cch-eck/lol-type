let championMap = {}; // maps championId (int) → { name: '아트록스', id: 'Aatrox' }

async function loadChampionData() {
  const versionRes = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
  const versions = await versionRes.json();
  const latest = versions[0];

  const champRes = await fetch(`https://ddragon.leagueoflegends.com/cdn/${latest}/data/ko_KR/champion.json`);
  const champData = await champRes.json();

  for (const champ of Object.values(champData.data)) {
    championMap[parseInt(champ.key)] = {
      name: champ.name,
      id: champ.id,
      image: `https://ddragon.leagueoflegends.com/cdn/${latest}/img/champion/${champ.image.full}`
    };
  }

  console.log('[INIT] Champion data loaded');
}
loadChampionData();

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 3000;
const RIOT_API_KEY = process.env.RIOT_API_KEY;

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(cors());

const REGION = 'https://kr.api.riotgames.com';
const GLOBAL = 'https://asia.api.riotgames.com';

app.get('/api/summoner', async (req, res) => {
  const { name, tag } = req.query;
  if (!name || !tag) return res.status(400).json({ error: 'Missing name or tag' });

  try {
    // Step 1: Get account info by Riot ID
    const accRes = await fetch(`${GLOBAL}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?api_key=${RIOT_API_KEY}`);
    console.log("[Step 1] Account Response Status:", accRes.status);
    if (!accRes.ok) throw new Error(`Failed to get account data: ${accRes.status}`);
    const accData = await accRes.json();

    // Step 2: Get summoner info
    const summRes = await fetch(`${REGION}/lol/summoner/v4/summoners/by-puuid/${accData.puuid}?api_key=${RIOT_API_KEY}`);
    console.log("[Step 2] Summoner Response Status:", summRes.status);
    if (!summRes.ok) throw new Error(`Failed to get summoner data: ${summRes.status}`);
    const summData = await summRes.json();

    // Step 3: Get ranked info
    const rankRes = await fetch(`${REGION}/lol/league/v4/entries/by-summoner/${summData.id}?api_key=${RIOT_API_KEY}`);
    console.log("[Step 3] Rank Response Status:", rankRes.status);
    if (!rankRes.ok) throw new Error(`Failed to get rank data: ${rankRes.status}`);
    const rankData = await rankRes.json();
    const soloQueue = rankData.find(q => q.queueType === 'RANKED_SOLO_5x5');

    // Step 4: Get top 3 champion masteries
    const masteryRes = await fetch(`${REGION}/lol/champion-mastery/v4/champion-masteries/by-puuid/${accData.puuid}?api_key=${RIOT_API_KEY}`);
    if (!masteryRes.ok) throw new Error(`Failed to get mastery data: ${masteryRes.status}`);
    const masteryData = await masteryRes.json();
    
    res.json({
      rank: soloQueue || null,
      top3Mastery: masteryData.slice(0, 3).map(m => ({
  championId: m.championId,
  championPoints: m.championPoints,
  name: championMap[m.championId]?.name || 'Unknown',
  image: championMap[m.championId]?.image || null
}))

    });
    } catch (err) {
    console.error('[API ERROR]', err);
    res.status(500).json({ error: 'Failed to fetch data from Riot API', detail: err.message || err.toString() });
    }
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));

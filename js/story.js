// Story: dialogue trees, spawns, encounters and endings.

export const SPAWNS = [
  { id: 'w1', type: 'wolf', x: 7.2, z: -13.2, yaw: 2.2, group: 'wolves' },
  { id: 'w2', type: 'wolf', x: 10.2, z: -11.2, yaw: 2.8, group: 'wolves' },
  { id: 'grukk', type: 'grukk', x: -14.2, z: -25.4, yaw: 0.3, group: 'camp', por: true },
  { id: 'g1', type: 'goblin', x: -11.4, z: -22.6, yaw: -1.2, group: 'camp' },
  { id: 'g2', type: 'goblin', x: -16.6, z: -21.4, yaw: 1.5, group: 'camp' },
  { id: 'g3', type: 'goblin', x: -13.6, z: -19.2, yaw: 3.0, group: 'camp' },
  { id: 'a1', type: 'archer', x: -18.4, z: -23.2, yaw: 1.0, group: 'camp' },
  { id: 'priest', type: 'priest', x: 8, z: -45.4, yaw: Math.PI, group: 'ruin', por: true },
  { id: 's1', type: 'skeleton', x: 5.0, z: -42.6, yaw: 0, group: 'ruin' },
  { id: 's2', type: 'skeleton', x: 11.0, z: -42.6, yaw: 0, group: 'ruin' },
];
export const GROUPS = {
  wolves: { aggro: 8.5, ambush: true },
  camp: { aggro: 11.5, talk: 'grukk', speaker: 'grukk' },
  ruin: { aggro: 12.5, talk: 'moross', speaker: 'priest' },
};
export const NPCS = [
  { id: 'elder', look: 'elder', name: '赫姆', role: '霧溪村村長', x: -2, z: 14.2, yaw: 0.2, talk: 'elder' },
  { id: 'merchant', look: 'merchant', name: '布莉', role: '雜貨攤老闆', x: 6.6, z: 23.6, yaw: Math.PI + 0.6, talk: 'bree' },
  { id: 'tom', look: 'hunter', name: '托姆', role: '受傷的獵人', x: 3.1, z: -3.5, yaw: 0.15, talk: 'tom', pose: 'sit' },
  { id: 'villager', look: 'villager', name: '磨坊工人', role: '村民', x: 5.6, z: 15.2, yaw: -1.2, talk: 'villager' },
  { id: 'kid', look: 'kid', name: '小麥', role: '村裡的小孩', x: -2.2, z: 23.2, yaw: 2.4, talk: 'kid' },
];

const cha = 'cha', wis = 'wis', int = 'int', str = 'str';
export const SK_CLS = { persuasion: cha, intimidation: cha, deception: cha, insight: wis, medicine: wis, perception: wis, arcana: int, religion: int, athletics: str, stealth: 'dex' };

export const DLG = {
  elder: {
    who: 'elder',
    entry: (S) => (S.f.hasLantern ? 'ret' : S.f.quest ? 'again' : 'start'),
    nodes: {
      start: { t: '「你們總算來了！我是霧溪村的村長，赫姆。」*老人拄著拐杖，眼睛一直往北邊的樹林瞟。*「三天前的晚上，晨星燈被偷了。就是北邊舊祠堂裡、照著溪水的那盞燈。」',
        o: [{ t: '「是誰偷的？」', go: 'who' }, { t: '「沒有那盞燈會怎樣？」', go: 'why' }, { t: '「報酬怎麼算？」', go: 'pay', if: (S) => !S.f.askedPay }, { t: '「我們這就出發。」', go: 'go' }] },
      hub: { t: '「還想知道什麼？」',
        o: [{ t: '「是誰偷的？」', go: 'who', if: (S) => !S.f.askedWho }, { t: '「沒有那盞燈會怎樣？」', go: 'why', if: (S) => !S.f.askedWhy }, { t: '「報酬怎麼算？」', go: 'pay', if: (S) => !S.f.askedPay }, { t: '「我們這就出發。」', go: 'go' }] },
      who: { do: (S) => (S.f.askedWho = 1), t: '「北邊樹林裡的哥布林。可是帶頭的……是個穿灰袍的人。」*說到「灰袍」的時候，他握著拐杖的手緊了一下。*',
        o: [{ t: '「你認識那個灰袍人，對吧？」', check: ['insight', 12], ok: 'lie', fail: 'lieFail' }, { t: '「好，我們會把燈帶回來。」', go: 'go' }, { t: '「我還有別的問題。」', go: 'hub' }] },
      lie: { do: (S) => (S.f.knowLie = 1), t: '赫姆沉默了很久。「……他叫莫洛斯。二十年前，他是祠堂的守燈人。」「他說燈裡封著不該封的東西，吵著要把燈熄掉。我怕村民恐慌，就……把他趕出了村子。」「我沒想到他還會回來。」',
        o: [{ t: '「我們會弄清楚的。」', go: 'hub' }] },
      lieFail: { t: '「我說了，我不知道！」*他把頭轉開。*「天快黑了，霧就要起來了。拜託你們。」', o: [{ t: '「……好吧。」', go: 'hub' }] },
      why: { do: (S) => (S.f.askedWhy = 1), t: '「溪上的霧每天晚上都會漲起來。以前有晨星燈照著，霧只到溪邊。」「這三個晚上，霧一夜比一夜高，昨晚已經漫到磨坊了。」「霧裡有聲音……像小孩在笑。現在天一黑，沒人敢出門。」',
        o: [{ t: '「我還有別的問題。」', go: 'hub' }, { t: '「我們這就出發。」', go: 'go' }] },
      pay: { do: (S) => (S.f.askedPay = 1), t: '「全村湊了兩百枚金幣。燈拿回來，錢就是你們的。」',
        o: [{ t: '「先付一部分吧。我們得買藥水和補給。」', check: ['persuasion', 13], ok: 'payOk', fail: 'payNo' }, { t: '「成交。」', go: 'hub' }] },
      payOk: { do: (S) => S.gold(50), t: '赫姆嘆了一口氣，從腰間解下錢袋。「拿去吧，五十枚。剩下的等燈回來再給。」', o: [{ t: '「多謝。」', go: 'hub' }] },
      payNo: { t: '「不行，村裡就只有這麼一點錢。燈回來再說。」', o: [{ t: '「好吧。」', go: 'hub' }] },
      go: { t: '「願晨星照著你們。祠堂在北邊，過了溪，穿過樹林就到了。」「對了，昨天獵人托姆去追那些哥布林，到現在還沒回來。你們路上留意一下。」', o: [{ t: '（出發）', ret: 'quest' }] },
      again: { t: '「燈……還沒找到嗎？天越來越黑了。」',
        o: [{ t: '「你認識那個灰袍人，對吧？」', check: ['insight', 12], ok: 'lie', fail: 'lieFail', if: (S) => !S.f.knowLie && !S.tried('elder:lie') }, { t: '「還在找。」', end: true }] },
      ret: { t: '*你們拿出晨星燈。燈芯裡的金光一閃一閃，像是在呼吸。*\n赫姆的眼睛亮了起來。「燈！你們真的把燈帶回來了！快，給我——」',
        o: [
          { t: '「拿去吧。」', ret: 'endA' },
          { t: '「先等等。我們知道燈裡封著什麼了。」', check: ['persuasion', 12], ok: 'confess', fail: 'refuse', if: (S) => S.f.truth },
          { t: '「這盞燈，我們自己留著。」', go: 'greed' },
        ] },
      confess: { t: '赫姆的手停在半空中。過了很久，他慢慢坐了下來。「……二十年前，溪水暴漲，五個孩子被沖走了。」「莫洛斯說，他們的魂還在霧裡，冷得發抖。他做了這盞燈，把他們接進去取暖。」「可是燈越亮，他們就燒掉越多。莫洛斯要熄燈，我不准。燈亮著，霧就不敢上岸。」「我錯了。我只想著村子，從來沒有想過那些孩子。」',
        o: [{ t: '「那就讓他們走吧。」', ret: 'endB' }] },
      refuse: { t: '「不行！」赫姆一把抓住燈。「沒有燈，霧會吞掉整個村子！你們拿了錢就走吧！」',
        o: [{ t: '「好吧……燈給你。」', ret: 'endA' }, { t: '「對不起，村長。」*（打開燈蓋）*', ret: 'endB2' }] },
      greed: { t: '赫姆愣住了。「你們……你們這群強盜！」', o: [{ t: '（帶著燈離開）', ret: 'endC' }, { t: '「開玩笑的。燈給你。」', ret: 'endA' }] },
    },
  },
  bree: {
    who: 'merchant',
    entry: () => 'start',
    nodes: {
      start: { t: (S) => `「歡迎光臨布莉的小攤！現在村裡就剩我還開著了。」「治療藥水，一瓶 ${S.price()} 金幣。」*你們有 ${S.goldNow()} 金幣。*`,
        o: [
          { t: (S) => `「買一瓶。」（${S.price()} 金幣）`, if: (S) => S.goldNow() >= S.price(), do: (S) => S.buy(1), go: 'bought' },
          { t: (S) => `「買三瓶。」（${S.price() * 3} 金幣）`, if: (S) => S.goldNow() >= S.price() * 3, do: (S) => S.buy(3), go: 'bought' },
          { t: '「我們是要去救全村的，算便宜一點吧？」', check: ['persuasion', 12], ok: 'disc', fail: 'nodisc', if: (S) => !S.f.discount && !S.tried('bree:disc') },
          { t: '「最近村裡有什麼消息？」', go: 'news' },
          { t: '「先不用了。」', end: true },
        ] },
      bought: { t: '「好眼光！喝之前記得搖一搖。」', o: [{ t: '「再看看。」', go: 'start' }, { t: '「謝了。」', end: true }] },
      disc: { do: (S) => (S.f.discount = 1), t: '布莉翻了個白眼，然後笑了出來。「好啦好啦，一瓶十五金幣。可別說出去。」', o: [{ t: '「謝謝！」', go: 'start' }] },
      nodisc: { t: '「救全村？那全村更應該付我錢才對。」', o: [{ t: '「……說得也是。」', go: 'start' }] },
      news: { do: (S) => (S.f.breeNews = 1), t: '「你說那個灰袍人嗎？我小時候好像見過他。以前祠堂的守燈人也穿灰袍，人很溫和，常常給我們小孩糖吃。」「後來他突然就不見了。村長從來不提他。」', o: [{ t: '「有意思。」', go: 'start' }] },
    },
  },
  tom: {
    who: 'tom',
    entry: (S) => (S.f.tomDone ? 'later' : S.f.tomFail ? 'again' : 'start'),
    nodes: {
      start: { t: '*一個獵人靠著樹坐著，腿上的傷口還在流血。*「……哥布林……牠們在營地……」',
        o: [
          { t: '幫他包紮傷口。', check: ['medicine', 11], ok: 'ok', fail: 'fail' },
          { t: '餵他喝一瓶治療藥水。', if: (S) => S.potions() > 0, do: (S) => S.usePotion(), go: 'ok' },
          { t: '「撐著點，我們會回來的。」', end: true },
        ] },
      again: { t: '*托姆昏昏沉沉的，嘴唇發白。*', o: [{ t: '餵他喝一瓶治療藥水。', if: (S) => S.potions() > 0, do: (S) => S.usePotion(), go: 'ok' }, { t: '（離開）', end: true }] },
      fail: { do: (S) => (S.f.tomFail = 1), t: '你們手忙腳亂，繃帶纏得太緊，托姆痛得昏了過去。至少他還有呼吸。也許一瓶藥水能讓他醒過來。', o: [{ t: '（離開）', end: true }] },
      ok: { do: (S) => { S.f.tomDone = 1; S.f.tomHint = 1; S.xp(50); }, t: '托姆深吸了一口氣，臉色好多了。「謝謝……我叫托姆。」「聽好，營地的頭目叫格魯克。他很怕那個灰袍的祭司——祭司把他兩個兄弟變成了骷髏，我躲在樹叢裡親耳聽見他們吵架。」「還有，東邊那片空地有狼，小心。我的背包掉在那裡了，裡面有藥水，撿到就歸你們。」',
        o: [{ t: '「你先回村子吧。」', ret: 'tomLeave' }] },
      later: { t: '「我好多了，謝謝你們。」「記住：格魯克怕那個祭司怕得要死。用這點去嚇他。」', o: [{ t: '「知道了。」', end: true }] },
    },
  },
  villager: {
    who: 'villager', entry: (S) => (S.f.hasLantern ? 'b' : 'a'),
    nodes: {
      a: { t: '「晚上千萬別靠近溪邊。我奶奶說，霧裡有東西在唱歌。」*他打了個寒顫。*「那首歌……我小時候好像聽過。」', o: [{ t: '（離開）', end: true }] },
      b: { t: '「那是晨星燈？你們找回來了！快拿給村長！」', o: [{ t: '（離開）', end: true }] },
    },
  },
  kid: {
    who: 'kid', entry: () => 'a',
    nodes: {
      a: { t: '「你們是冒險者嗎？你們有沒有打過龍？」*小麥的眼睛閃閃發亮。*「我長大以後也要當冒險者，然後把霧裡的妖怪全部打跑！」',
        o: [{ t: '「當然打過，龍很怕我們。」', go: 'b' }, { t: '「冒險者也會怕。重要的是怕了還是去做。」', go: 'c' }, { t: '（摸摸他的頭）', end: true }] },
      b: { t: '「哇——！」', o: [{ t: '（離開）', end: true }] },
      c: { t: '小麥認真地點點頭。「那我現在就不怕了。……一點點怕。」', o: [{ t: '（離開）', end: true }] },
    },
  },
  grukk: {
    who: 'grukk', entry: () => 'start',
    nodes: {
      start: { t: '*一個戴著骷髏頭盔的大哥布林從火堆邊站起來，拎著一把大斧頭。*「站住，粉紅皮的！這是格魯克的路！」「要過去？留下金子。還有靴子。格魯克喜歡靴子。」',
        o: [
          { t: '「數數看，你們有幾個，我們有幾把劍？」', check: ['intimidation', 14], ok: 'scared', fail: 'angry' },
          { t: '「祭司把你的兄弟變成了骷髏。你覺得下一個輪到誰？」', check: ['persuasion', 10], ok: 'turn', fail: 'angry', if: (S) => S.f.tomHint },
          { t: '「灰袍派我們來的。他要你們馬上回祠堂守著。」', check: ['deception', 13], ok: 'fooled', fail: 'angry2' },
          { t: '「給你三十金幣，讓我們過去。」', if: (S) => S.goldNow() >= 30, do: (S) => S.gold(-30), go: 'paid' },
          { t: '「休想。」', go: 'fight' },
        ] },
      scared: { do: (S) => S.xp(150), t: '格魯克的眼睛在你們的武器上掃了好幾遍。旁邊的哥布林已經悄悄往後退了。「……格魯克今天不想打架。格魯克要去打獵！」*哥布林們一溜煙鑽進了樹林。*', o: [{ t: '（看著他們跑掉）', ret: 'flee' }] },
      turn: { do: (S) => { S.f.knowBraziers = 1; S.xp(200); }, t: '格魯克的斧頭垂了下來。「……祭司說，燈點起來以後，霧裡的死人都會聽他的話。可是他把布魯克和斯納格變成了骨頭。」「格魯克不想變成骨頭。」他壓低聲音：「祭司的骷髏，是靠那兩個藍色火盆站著的。火盆倒了，骷髏就倒了。」「格魯克走了。祝你們好運，粉紅皮的。」', o: [{ t: '「謝了，格魯克。」', ret: 'flee' }] },
      fooled: { do: (S) => S.xp(100), t: '「灰袍派你們來的？」格魯克抓了抓頭。「……灰袍很可怕。好啦好啦，格魯克不想惹他生氣。」*他帶著手下慌慌張張地往西邊的樹林跑了。*', o: [{ t: '（忍住笑）', ret: 'flee' }] },
      angry2: { t: '「騙子！灰袍才不會派粉紅皮的來！」', o: [{ t: '（拔出武器）', ret: 'fight' }] },
      paid: { t: '格魯克用牙齒咬了咬金幣。「好！粉紅皮的可以過去。靴子下次再說。」', o: [{ t: '（離開）', ret: 'peace' }] },
      angry: { t: '「格魯克才不怕！小的們，抓住他們！」', o: [{ t: '（拔出武器）', ret: 'fight' }] },
      fight: { t: '「好！格魯克最喜歡打架了！」', o: [{ t: '（拔出武器）', ret: 'fight' }] },
    },
  },
  grukkPeace: { who: 'grukk', entry: () => 'a', nodes: { a: { t: '「粉紅皮的付過錢了。快走快走。」', o: [{ t: '（離開）', end: true }, { t: '（攻擊他們）', ret: 'fight' }] } } },
  moross: {
    who: 'priest', entry: () => 'start',
    nodes: {
      start: { t: '*廢墟中央站著一個穿灰袍的男人，背對著你們。祭壇上的晨星燈發著金光，照亮了兩個骷髏兵空洞的眼窩。*「赫姆終於捨得花錢了。」*他轉過身，兜帽底下亮著兩點橘紅色的光。*「回去吧。這盞燈不屬於霧溪村。」',
        o: [
          { t: '「燈是村子的。交出來。」', go: 'whose' },
          { t: '「你不像是想要力量的人。你在保護什麼？」', check: ['insight', 12], ok: 'truth', fail: 'cold', if: (S) => !S.f.knowLie },
          { t: '「赫姆說，你以前是祠堂的守燈人。」', go: 'truth', if: (S) => S.f.knowLie },
          { t: '（仔細觀察那兩個藍色火盆）', check: ['arcana', 13], ok: 'arcOk', fail: 'arcNo', if: (S) => !S.f.knowBraziers && !S.tried('moross:arcOk') },
          { t: '「最後一次機會，老頭。」', check: ['intimidation', 18], ok: 'shaken', fail: 'laugh' },
        ] },
      whose: { t: '「村子的？」他笑了，笑聲很乾。「赫姆有沒有告訴你們，燈裡封著的是什麼？」',
        o: [
          { t: '「那你告訴我們。」', check: ['persuasion', 11], ok: 'truth', fail: 'cold' },
          { t: '「赫姆說，你以前是祠堂的守燈人。」', go: 'truth', if: (S) => S.f.knowLie },
          { t: '「我們不在乎。」', go: 'fight' },
        ] },
      truth: { do: (S) => (S.f.truth = 1), t: '莫洛斯沉默了一會兒。「……二十年前，霧溪暴漲，五個孩子被沖走了。」「他們的魂留在霧裡，又冷又怕。我做了這盞燈，把他們接進來取暖。」「可是燈每亮一夜，他們就被燒掉一點。我想熄燈，讓他們走。赫姆不准，因為燈亮著，霧就不敢上岸。他把我推進溪裡，以為我死了。」「現在你們知道了。你們還要把燈拿回去，讓他們繼續燒嗎？」',
        o: [
          { t: '「跟我們一起回村子，當著大家的面把話說清楚。」', check: ['persuasion', 13], ok: 'peace', fail: 'nopeace' },
          { t: '「你為什麼要叫哥布林去偷？為什麼要養骷髏？」', go: 'why' },
          { t: '「孩子的事我們會處理。但燈得跟我們走。」', go: 'fight' },
        ] },
      why: { t: '「因為我一個人搶不回來。」他看了一眼骷髏兵。「它們是溪邊的老墳。我只是借它們站一會兒。」', o: [
        { t: '「跟我們一起回村子，當著大家的面把話說清楚。」', check: ['persuasion', 13], ok: 'peace', fail: 'nopeace', if: (S) => !S.tried('moross:peace') },
        { t: '「燈得跟我們走。」', go: 'fight' }] },
      peace: { do: (S) => { S.f.peace = 1; S.xp(450); }, t: '莫洛斯看了你們很久，然後揮了揮手。骷髏兵像斷了線的木偶一樣倒在地上。「好。燈你們拿去，我在這裡等。」「如果赫姆還是不肯說實話……燈就交給你們決定了。」', o: [{ t: '「我們會做對的事。」', ret: 'peace' }] },
      nopeace: { t: '「說清楚？二十年前我就試過了。」他舉起法杖，杖頂的火焰暴漲。「我不會再讓任何人把燈拿走。」', o: [{ t: '（準備戰鬥）', ret: 'fight' }] },
      cold: { t: '「你們不懂，也不需要懂。」*他舉起法杖。*', o: [{ t: '（準備戰鬥）', ret: 'fight' }] },
      arcOk: { do: (S) => (S.f.knowBraziers = 1), t: '*你注意到，藍色火盆的火焰跟骷髏兵眼窩裡的光同時閃動。它們是靠火盆的力量站著的——只要踢翻火盆，骷髏就會散架。*', o: [{ t: '（繼續）', go: 'start' }] },
      arcNo: { t: '*藍色的火焰很漂亮。除此之外，你什麼也看不出來。*', o: [{ t: '（繼續）', go: 'start' }] },
      shaken: { t: '莫洛斯往後退了一步，骷髏兵也跟著遲疑了一下。你們抓住機會搶先動手！', o: [{ t: '（搶先攻擊）', ret: 'surprise' }] },
      laugh: { t: '「我在溪底躺過一整夜。你覺得我還會怕什麼？」', o: [{ t: '（準備戰鬥）', ret: 'fight' }] },
      fight: { t: '「那就來吧。」', o: [{ t: '（準備戰鬥）', ret: 'fight' }] },
    },
  },
  morossPeace: { who: 'priest', entry: () => 'a', nodes: { a: { t: '「燈在祭壇上。去吧。」*他望著溪的方向。*「告訴那些孩子……對不起，讓他們等了這麼久。」', o: [{ t: '（離開）', end: true }] } } },
};

export const ENDINGS = {
  endA: (f) => ({ title: '結局：燈火長明', lines: ['晨星燈重新掛回了祠堂。', '那天晚上，霧只漲到溪邊就停住了。村民們在營火邊唱了一整晚的歌。', f.truth ? '只有你們知道，燈芯裡的金光每閃一下，就有一個小小的聲音在喊冷。' : '赫姆把剩下的金幣交給你們，手一直在發抖。你們沒有問為什麼。'] }),
  endB: (f) => ({ title: '結局：送魂', lines: ['那天深夜，全村的人都來到溪邊。赫姆把二十年前的事說了出來，一個字也沒有漏。', f.peace ? '莫洛斯拄著法杖站在他旁邊。兩個老人都沒有說話。' : '人群裡有人在哭，也有人低著頭，想起了小時候聽過的那首歌。', '燈蓋打開了。五個小小的光點飄了出來，在溪面上繞了三圈，像是在說再見。', '然後它們慢慢升上了夜空。從那天起，霧溪再也沒有起過霧。'], orbs: true }),
  endB2: () => ({ title: '結局：違命送魂', lines: ['燈蓋打開的時候，赫姆跪在泥地上大喊。村民們聽到聲音，全都跑了過來。', '五個小小的光點飄出燈芯，在溪面上繞了三圈，然後升上了夜空。霧散了。', '有人說你們是英雄，也有人說你們是小偷。赫姆一直沒有付剩下的錢。', '不過從那天起，霧溪再也沒有起過霧。'], orbs: true }),
  endC: () => ({ title: '結局：竊燈者', lines: ['你們帶著晨星燈離開了霧溪村。', '身後，溪上的霧慢慢漲了起來。它漫過橋面，漫過磨坊，漫過一間又一間的屋頂。', '霧裡傳來細細的歌聲。', '你們沒有回頭。'], mist: true }),
};

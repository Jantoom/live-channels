// One-sentence descriptions for channels whose i.mjh.nz entry has none, keyed by
// the channel name exactly as i.mjh.nz spells it. Regional variants ("Seven
// Cairns", "Channel 9 (Gold Coast)", "7two Regional") fall back to their base
// channel. Channels missing from both lists get a generic sentence, so new ones
// still build; add them here when they show up.

const PLATFORM = { Seven: "7plus", Nine: "9Now", Ten: "10", ABC: "ABC iview", SBS: "SBS On Demand", Sky: "Sky" };

const DESCRIPTIONS = {
  // Network 10
  "10": "Network 10's main free-to-air channel, with entertainment, reality, news and lifestyle shows.",
  "10 Comedy": "Network 10's comedy channel (formerly 10 Peach), playing classic sitcoms and game shows.",
  "10 Drama": "Network 10's drama channel (formerly 10 Bold), with crime and action series plus lifestyle repeats.",
  "Nickelodeon": "Nickelodeon's free-to-air kids' channel on Network 10, with SpongeBob SquarePants, PAW Patrol and other Nick shows.",
  "Gecko TV": "A home shopping channel carried on Network 10.",
  "Big Brother Live Stream": "The live feed from inside the Big Brother house.",
  "Adult Animation": "A 24/7 channel on 10 playing adult cartoons like Daria, Drawn Together and Ugly Americans.",
  "Crime Hunters": "A 24/7 channel on 10 with forensic and FBI case documentaries.",
  "Crime Time": "A 24/7 channel on 10 with true crime documentary series.",
  "Haunt TV": "A 24/7 channel on 10 with paranormal and ghost-story series.",
  "History & Warfare": "A 24/7 channel on 10 with military history documentaries.",
  "Jamie Oliver": "A 24/7 channel on 10 playing Jamie Oliver's cooking shows.",
  "Medical Emergency": "A 24/7 channel on 10 with emergency room and paramedic series.",
  "Moviesphere": "A 24/7 movie channel on 10, mostly horror and genre films.",
  "Thriller Movies": "A 24/7 movie channel on 10 playing thrillers and TV movies.",
  "Nick Jr Club": "A 24/7 channel on 10 for preschoolers, with Nick Jr shows like Bubble Guppies and Dora the Explorer.",
  "NickTeen": "A 24/7 channel on 10 with Nickelodeon's live-action teen sitcoms.",
  "NickToons": "A 24/7 channel on 10 with Nickelodeon cartoons.",
  "NickToons 90s": "A 24/7 channel on 10 with Nickelodeon cartoons from the '90s and 2000s.",
  "True Stories": "A 24/7 channel on 10 with real-life survival, scandal and true crime stories.",
  "Wildest": "A 24/7 channel on 10 with wildlife documentaries.",
  "Shockwave": "A 24/7 channel on 10 with disaster and engineering documentaries.",
  "rookie-blue": "A 24/7 channel on 10 playing the police drama Rookie Blue.",
  "World Of Survivor": "A 24/7 channel on 10 playing seasons of Australian Survivor.",
  "Next Top Model": "A 24/7 channel on 10 playing Australia's Next Top Model.",
  "MTV The Shores": "A 24/7 channel on 10 playing Jersey Shore and other MTV shore shows.",
  "MTV Ridiculousness": "A 24/7 channel on 10 playing MTV's Ridiculousness.",
  "Rush": "A 24/7 channel on 10 playing the Australian police drama Rush.",

  // ABC
  "ABC TV": "The ABC's main channel, with Australian drama, comedy, news, current affairs and documentaries.",
  "ABC Kids": "The ABC's ad-free daytime channel for preschoolers, with shows like Bluey, Peppa Pig and Play School.",
  "ABC Family": "The ABC's evening channel for families, sharing its slot with ABC Kids during the day.",
  "ABC Entertains": "The ABC's entertainment channel, with British comedy, panel shows and documentaries.",
  "ABC NEWS": "The ABC's 24-hour news channel.",

  // SBS
  "SBS": "SBS's main channel, with world news, documentaries, international drama and sport.",
  "SBS2": "SBS's second channel, with international series, quiz shows and world news bulletins.",
  "SBS World Movies": "SBS's movie channel, showing films from around the world.",
  "SBS Food": "SBS's food channel, with cooking and food travel shows from Australia and around the world.",
  "NITV": "National Indigenous Television, SBS's channel by and for Aboriginal and Torres Strait Islander peoples.",
  "SBS Arabic": "SBS's Arabic-language radio station, streamed as a channel.",
  "SBS South Asian": "SBS's South Asian radio and music station, streamed as a channel.",
  "SBS PopAsia": "SBS's Asian pop music station, streamed as a channel.",
  "SBS Chill": "SBS's chill-out music station, streamed as a channel.",
  "SBS Radio 1": "SBS's multilingual radio service, with programs in dozens of languages, streamed as a channel.",
  "SBS Radio 2": "SBS's multilingual radio service, with programs in dozens of languages, streamed as a channel.",
  "SBS Radio 3": "SBS's multilingual radio service, with programs in dozens of languages, streamed as a channel.",
  "SBS Radio 4": "SBS's multilingual radio service, with programs in dozens of languages, streamed as a channel.",
  "euronews": "Euronews, the European international news channel, carried by SBS.",
  "France 24": "France 24, the French international news channel, carried by SBS.",
  "FIFA+": "FIFA's football channel, with match replays, documentaries and archive football, carried by SBS.",
  "The Cook Up": "A 24/7 SBS channel playing The Cook Up with Adam Liaw.",
  "Insight": "A 24/7 SBS channel playing episodes of Insight, its long-running discussion program.",
  "Dateline": "A 24/7 SBS channel playing episodes of Dateline, its international documentary program.",
  "Koori Knockout": "An SBS channel for the Koori Knockout, the Aboriginal rugby league carnival.",

  // Seven
  "Seven": "The Seven Network's main channel, with news, Sunrise, AFL, cricket and entertainment.",
  "7two": "Seven's channel for lifestyle, travel and British drama.",
  "7mate": "Seven's channel aimed at men, with reality, motoring, action movies and sport.",
  "7flix": "Seven's channel for movies and drama.",
  "7Bravo": "Seven's channel for reality and entertainment shows from Bravo and NBCUniversal, plus game shows.",
  "TVSN": "A 24-hour home shopping channel.",
  "Racing.com": "Racing Victoria's channel, with live thoroughbred racing, form and analysis.",
  "Racing WA": "Live racing from Western Australia's tracks.",
  "7AFL": "Seven's 24/7 AFL channel, replaying classic and recent matches.",
  "7NEWS Spotlight": "Seven's channel for 7NEWS Spotlight's investigative documentaries.",
  "Cricket Gold": "Seven's channel of classic cricket matches and highlights.",
  "LIV Golf Replays": "Seven's channel replaying LIV Golf tournaments.",
  "ausbiz": "Australian business and markets news, streamed on 7plus.",
  "All-Star Cinema": "A 24/7 movie channel on 7plus.",
  "Blue Light": "A 24/7 channel on 7plus with police shows like Highway Patrol.",
  "Medical And Rescue": "A 24/7 channel on 7plus with paramedic, lifeguard and emergency room series.",
  "Surveillance Central": "A 24/7 channel on 7plus with dashcam and surveillance footage shows.",
  "True Crime Files": "A 24/7 channel on 7plus with true crime documentaries.",
  "Travel Australia": "A 24/7 channel on 7plus with Australian travel and four-wheel-driving shows.",
  "Mighty Machines": "A 24/7 channel on 7plus with engineering series like Mighty Ships and Mighty Trains.",
  "Home and Away Classics": "A 24/7 channel on 7plus replaying classic Home and Away episodes.",
  "CSI Crime Scene Investigation": "A 24/7 channel on 7plus playing CSI and its spin-offs.",
  "Anglers Paradise": "A 24/7 channel on 7plus with fishing shows.",
  "Border Security Australia": "A 24/7 channel on 7plus playing Border Security: Australia's Front Line.",

  // Nine
  "Channel 9": "The Nine Network's main channel, with news, current affairs, NRL, reality and entertainment.",
  "9Gem": "Nine's channel for drama, classic movies and extra sport coverage.",
  "9Go!": "Nine's channel for younger viewers, with comedy, drama, movies and sport.",
  "9Life": "Nine's lifestyle channel, with home, renovation, food and travel shows.",
  "9Rush": "Nine's channel for adventure, motoring and reality shows.",
  "9Crime": "A 24/7 channel on 9Now with crime documentaries and dramas.",
  "9Mystery&Paranormal": "A 24/7 channel on 9Now with mystery and paranormal series.",
  "BBC Antiques Roadshow": "A 24/7 channel on 9Now playing the BBC's Antiques Roadshow.",
  "BBC Comedy": "A 24/7 channel on 9Now with BBC comedy series.",
  "BBC Food": "A 24/7 channel on 9Now with BBC cooking shows.",
  "BBC Home & Garden": "A 24/7 channel on 9Now with BBC home and garden shows.",
  "BBC Top Gear": "A 24/7 channel on 9Now playing Top Gear.",
  "H2": "A 24/7 channel on 9Now with history documentaries.",
  "LMN": "A 24/7 channel on 9Now with Lifetime thriller and drama movies.",
  "Taronga 24/7": "A 24/7 channel on 9Now with shows from Sydney's Taronga Zoo.",
  "WNBL 2026/27": "Nine's channel for the WNBL, Australia's women's basketball league.",
  "Youth Olympic Games Dakar 2026": "Nine's channel for the 2026 Youth Olympic Games in Dakar.",

  // Sky and others
  "Sky Racing #1": "Sky Racing's main channel, with live thoroughbred, harness and greyhound racing.",
  "Sky Racing #2": "Sky Racing's second channel, with more live thoroughbred, harness and greyhound racing.",
  "Sky Racing - Thoroughbred Central": "Sky Racing's thoroughbred channel, with racing from tracks around Australia.",
  "Bloomberg TV": "Bloomberg's global business and markets news channel.",
  "Channel News Asia (CNA)": "CNA, Singapore's international English-language news channel.",
  "YouTV": "A free channel carried on Network 10.",
};

// Streaming channels that play one show back to back. The value is the show's
// name when it differs from the channel's.
const SINGLE_SHOW = {
  "48 Hours": "", "8 Out Of 10 Cats": "", "Anthony Bourdain: Parts Unknown": "", "Becker": "",
  "COPS": "", "Dallas Cowboy Cheerleaders: Making The Team": "", "Deadly Women": "",
  "Diagnosis Murder": "", "Embarrassing Bodies": "", "Ghost Hunters": "", "Hardcore Pawn": "",
  "Have You Been Paying Attention?": "", "Heartland": "", "Highway Thru Hell": "", "Judge Judy": "",
  "MasterChef": "MasterChef Australia", "Prisoner: Cell Block H": "", "Project Runway": "",
  "SpongeBob SquarePants": "", "Thank God You're Here": "", "The Cheap Seats": "",
  "The Graham Norton Show": "", "The Only Way Is Essex": "", "Undercover Boss": "", "Wicked Tuna": "",
  "24 Hours in A&E": "", "A Country Practice": "", "Air Crash Investigations": "", "All Saints": "",
  "Antiques Road Trip": "", "Below Deck Vault": "Below Deck", "Better Homes And Gardens": "",
  "Blue Heelers": "", "Bondi Rescue": "", "Bondi Vet": "", "Botched VAULT": "Botched",
  "Escape to the Country": "", "Hells Kitchen": "Hell's Kitchen", "Kitchen Nightmares": "",
  "Million Dollar Listing VAULT": "Million Dollar Listing", "Mythbusters": "MythBusters", "NCIS": "",
  "On The Case": "", "Outback Truckers": "", "The Real Housewives VAULT": "The Real Housewives",
  "The Yorkshire Vet": "", "Trucking Hell": "", "Water Rats": "", "Winners & Losers": "",
  "60 Minutes Australia": "60 Minutes", "Dance Moms 24/7": "Dance Moms",
  "Married At First Sight": "", "Real Emergency": "", "Seinfeld": "", "The Block 24/7": "The Block",
};

/** "Seven Cairns" → "Seven", "Channel 9 (Gold Coast)" → "Channel 9", "7two Regional" → "7two". */
function baseName(name) {
  return name.replace(/\s*\([^)]*\)$/, "").replace(/\s+Regional$/, "").replace(/^Seven\s+.+$/, "Seven");
}

export function describe(name, network, { singleShowShare = 0 } = {}) {
  const platform = PLATFORM[network];
  const on = platform ? ` on ${platform}` : "";
  for (const n of [name, baseName(name)]) {
    if (DESCRIPTIONS[n]) return DESCRIPTIONS[n];
    if (n in SINGLE_SHOW) return `A 24/7 channel${on} playing ${SINGLE_SHOW[n] || n} back to back.`;
  }
  // Unlisted channel whose schedule is nearly all one show.
  if (singleShowShare >= 0.8) return `A 24/7 channel${on} playing ${name} back to back.`;
  return platform ? `A free streaming channel from ${platform}.` : "A free streaming channel.";
}

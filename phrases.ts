
import { Phrase } from './types';

// Helper types for compact storage
type Difficulty = 'easy' | 'medium' | 'hard';
// Format: [English, Portuguese, Difficulty, Category]
type CompactPhrase = [string, string, Difficulty, string];

// A curated list targeting the most statistically used structures in English
const RAW_DATA: CompactPhrase[] = [
  // ==================================================================================
  // BLOCK 1: THE CORE VERBS (BE, HAVE, DO, SAY, GET, MAKE, GO, KNOW, TAKE, SEE)
  // These 10 verbs account for a huge % of spoken English.
  // ==================================================================================
  
  // TO BE (Ser/Estar)
  ["I am happy to be here.", "Estou feliz por estar aqui.", "easy", "Top 10 Verbs"],
  ["She is a doctor.", "Ela é médica.", "easy", "Top 10 Verbs"],
  ["We are friends.", "Nós somos amigos.", "easy", "Top 10 Verbs"],
  ["Are you busy right now?", "Você está ocupado agora?", "easy", "Top 10 Verbs"],
  ["It was a good day.", "Foi um bom dia.", "easy", "Top 10 Verbs"],
  ["They were at the party.", "Eles estavam na festa.", "easy", "Top 10 Verbs"],
  ["I will be there soon.", "Estarei lá em breve.", "easy", "Top 10 Verbs"],
  
  // TO HAVE (Ter)
  ["I have a question.", "Eu tenho uma pergunta.", "easy", "Top 10 Verbs"],
  ["Do you have a minute?", "Você tem um minuto?", "easy", "Top 10 Verbs"],
  ["She has a new car.", "Ela tem um carro novo.", "easy", "Top 10 Verbs"],
  ["We had a great time.", "Nós nos divertimos muito.", "easy", "Top 10 Verbs"],
  ["I have to go now.", "Eu tenho que ir agora.", "easy", "Top 10 Verbs"],
  ["Have you seen this?", "Você viu isso?", "medium", "Top 10 Verbs"],

  // TO DO (Fazer)
  ["I do my homework every day.", "Eu faço meu dever de casa todo dia.", "easy", "Top 10 Verbs"],
  ["What do you do?", "O que você faz (profissão)?", "easy", "Top 10 Verbs"],
  ["Did you call me?", "Você me ligou?", "easy", "Top 10 Verbs"],
  ["I didn't do it.", "Eu não fiz isso.", "easy", "Top 10 Verbs"],
  ["Do me a favor, please.", "Me faça um favor, por favor.", "easy", "Top 10 Verbs"],

  // TO SAY (Dizer)
  ["What did you say?", "O que você disse?", "easy", "Top 10 Verbs"],
  ["She said hello.", "Ela disse olá.", "easy", "Top 10 Verbs"],
  ["I just want to say thank you.", "Só quero dizer obrigado.", "easy", "Top 10 Verbs"],
  ["They say it is going to rain.", "Dizem que vai chover.", "medium", "Top 10 Verbs"],
  ["Don't say that!", "Não diga isso!", "easy", "Top 10 Verbs"],

  // TO GET (Pegar/Conseguir/Ficar/Chegar - The Chameleon Verb)
  ["I get it.", "Eu entendi.", "easy", "Top 10 Verbs"],
  ["Can I get a coffee?", "Pode me ver um café?", "easy", "Top 10 Verbs"],
  ["I need to get home.", "Preciso chegar em casa.", "easy", "Top 10 Verbs"],
  ["It is getting late.", "Está ficando tarde.", "medium", "Top 10 Verbs"],
  ["Did you get my email?", "Você recebeu meu e-mail?", "medium", "Top 10 Verbs"],
  ["How do I get to the airport?", "Como chego ao aeroporto?", "medium", "Top 10 Verbs"],
  ["I got lost.", "Eu me perdi.", "easy", "Top 10 Verbs"],

  // TO MAKE (Fazer/Criar)
  ["I made a mistake.", "Eu cometi um erro.", "easy", "Top 10 Verbs"],
  ["Can you make dinner?", "Você pode fazer o jantar?", "easy", "Top 10 Verbs"],
  ["This makes sense.", "Isso faz sentido.", "easy", "Top 10 Verbs"],
  ["Don't make noise.", "Não faça barulho.", "easy", "Top 10 Verbs"],
  ["I want to make a reservation.", "Quero fazer uma reserva.", "medium", "Top 10 Verbs"],

  // TO GO (Ir)
  ["I am going to work.", "Estou indo para o trabalho.", "easy", "Top 10 Verbs"],
  ["Let's go!", "Vamos!", "easy", "Top 10 Verbs"],
  ["Where did she go?", "Para onde ela foi?", "easy", "Top 10 Verbs"],
  ["I went to the store.", "Fui à loja.", "easy", "Top 10 Verbs"],
  ["We are going to travel.", "Nós vamos viajar.", "medium", "Top 10 Verbs"],

  // TO KNOW (Saber/Conhecer)
  ["I know the answer.", "Eu sei a resposta.", "easy", "Top 10 Verbs"],
  ["I don't know him.", "Eu não o conheço.", "easy", "Top 10 Verbs"],
  ["Do you know where it is?", "Você sabe onde fica?", "easy", "Top 10 Verbs"],
  ["I didn't know that.", "Eu não sabia disso.", "easy", "Top 10 Verbs"],
  ["Let me know if you need help.", "Me avise se precisar de ajuda.", "medium", "Top 10 Verbs"],

  // TO TAKE (Levar/Tomar)
  ["Take this with you.", "Leve isso com você.", "easy", "Top 10 Verbs"],
  ["How long does it take?", "Quanto tempo demora?", "medium", "Top 10 Verbs"],
  ["I need to take a break.", "Preciso fazer uma pausa.", "easy", "Top 10 Verbs"],
  ["Did you take the medicine?", "Você tomou o remédio?", "easy", "Top 10 Verbs"],
  ["Can you take a picture?", "Você pode tirar uma foto?", "easy", "Top 10 Verbs"],

  // TO SEE (Ver)
  ["I see what you mean.", "Entendo o que você quer dizer.", "medium", "Top 10 Verbs"],
  ["Did you see that?", "Você viu aquilo?", "easy", "Top 10 Verbs"],
  ["I will see you tomorrow.", "Vejo você amanhã.", "easy", "Top 10 Verbs"],
  ["Let me see.", "Deixe-me ver.", "easy", "Top 10 Verbs"],
  ["I haven't seen him lately.", "Não o tenho visto ultimamente.", "medium", "Top 10 Verbs"],

  // ==================================================================================
  // BLOCK 2: ESSENTIAL SURVIVAL PHRASES (A1)
  // ==================================================================================
  ["Hello, how are you?", "Olá, como você está?", "easy", "Greetings"],
  ["I'm fine, thanks.", "Estou bem, obrigado(a).", "easy", "Greetings"],
  ["Nice to meet you.", "Prazer em conhecer você.", "easy", "Greetings"],
  ["My name is...", "Meu nome é...", "easy", "Greetings"],
  ["Where are you from?", "De onde você é?", "easy", "Greetings"],
  ["Yes, please.", "Sim, por favor.", "easy", "Essentials"],
  ["No, thank you.", "Não, obrigado(a).", "easy", "Essentials"],
  ["I don't understand.", "Eu não entendo.", "easy", "Essentials"],
  ["Can you help me?", "Você pode me ajudar?", "easy", "Essentials"],
  ["Excuse me.", "Com licença.", "easy", "Essentials"],
  ["I am sorry.", "Desculpe-me.", "easy", "Essentials"],
  ["How much is this?", "Quanto custa isto?", "easy", "Essentials"],
  ["Where is the bathroom?", "Onde fica o banheiro?", "easy", "Essentials"],
  ["Do you speak English?", "Você fala inglês?", "easy", "Essentials"],
  ["Speak slower, please.", "Fale mais devagar, por favor.", "easy", "Essentials"],
  ["What time is it?", "Que horas são?", "easy", "Essentials"],

  // ==================================================================================
  // BLOCK 3: MOST COMMON QUESTIONS (Who, What, Where, When, Why, How)
  // ==================================================================================
  ["Who is that?", "Quem é aquele?", "easy", "Questions"],
  ["What is happening?", "O que está acontecendo?", "easy", "Questions"],
  ["Where are we going?", "Para onde estamos indo?", "easy", "Questions"],
  ["When does it start?", "Quando começa?", "easy", "Questions"],
  ["Why are you late?", "Por que você está atrasado?", "easy", "Questions"],
  ["How are you doing?", "Como você está?", "easy", "Questions"],
  ["How much does it cost?", "Quanto custa?", "easy", "Questions"],
  ["How old are you?", "Quantos anos você tem?", "easy", "Questions"],
  ["Which one do you prefer?", "Qual você prefere?", "medium", "Questions"],
  ["Whose phone is this?", "De quem é este telefone?", "medium", "Questions"],

  // ==================================================================================
  // BLOCK 4: CONNECTORS & TRANSITIONS (The Glue of Speech)
  // ==================================================================================
  ["And then...", "E então...", "easy", "Connectors"],
  ["But I think...", "Mas eu acho...", "easy", "Connectors"],
  ["Because of that...", "Por causa disso...", "medium", "Connectors"],
  ["However, I disagree.", "No entanto, eu discordo.", "medium", "Connectors"],
  ["Actually, it's true.", "Na verdade, é verdade.", "medium", "Connectors"],
  ["Basically, yes.", "Basicamente, sim.", "medium", "Connectors"],
  ["Anyway, let's go.", "Enfim, vamos lá.", "medium", "Connectors"],
  ["Also, I need this.", "Além disso, preciso disso.", "medium", "Connectors"],
  ["For example...", "Por exemplo...", "easy", "Connectors"],
  ["In other words...", "Em outras palavras...", "medium", "Connectors"],

  // ==================================================================================
  // BLOCK 5: TRAVEL & REAL WORLD
  // ==================================================================================
  ["I am lost.", "Estou perdido.", "easy", "Travel"],
  ["I need a taxi.", "Eu preciso de um táxi.", "easy", "Travel"],
  ["Is it far?", "É longe?", "easy", "Travel"],
  ["Turn left.", "Vire à esquerda.", "easy", "Travel"],
  ["Turn right.", "Vire à direita.", "easy", "Travel"],
  ["I have a reservation.", "Eu tenho uma reserva.", "easy", "Travel"],
  ["My luggage is missing.", "Minha bagagem sumiu.", "easy", "Travel"],
  ["Is there free Wi-Fi?", "Tem Wi-Fi grátis?", "easy", "Travel"],
  ["I would like water.", "Eu gostaria de água.", "easy", "Dining"],
  ["The check, please.", "A conta, por favor.", "easy", "Dining"],
  ["Do you accept credit cards?", "Você aceita cartão de crédito?", "medium", "Shopping"],
  
  // ==================================================================================
  // BLOCK 6: FEELINGS & OPINIONS
  // ==================================================================================
  ["I am tired.", "Estou cansado.", "easy", "Feelings"],
  ["I am hungry.", "Estou com fome.", "easy", "Feelings"],
  ["I am excited!", "Estou empolgado!", "easy", "Feelings"],
  ["I feel sick.", "Estou me sentindo mal.", "medium", "Health"],
  ["I think so.", "Eu acho que sim.", "easy", "Opinions"],
  ["I don't think so.", "Eu acho que não.", "easy", "Opinions"],
  ["Are you sure?", "Você tem certeza?", "easy", "Opinions"],
  ["It depends.", "Depende.", "easy", "Opinions"],
  ["It doesn't matter.", "Não importa.", "medium", "Opinions"],
  ["I agree with you.", "Eu concordo com você.", "medium", "Opinions"],

  // ==================================================================================
  // BLOCK 7: TIME & FREQUENCY
  // ==================================================================================
  ["Always.", "Sempre.", "easy", "Time"],
  ["Never.", "Nunca.", "easy", "Time"],
  ["Sometimes.", "Às vezes.", "easy", "Time"],
  ["Often.", "Frequentemente.", "easy", "Time"],
  ["Right now.", "Agora mesmo.", "easy", "Time"],
  ["Yesterday.", "Ontem.", "easy", "Time"],
  ["Tomorrow.", "Amanhã.", "easy", "Time"],
  ["Next week.", "Semana que vem.", "easy", "Time"],
  ["Last year.", "Ano passado.", "easy", "Time"],
  ["In a moment.", "Em um momento.", "medium", "Time"],
  
  // ==================================================================================
  // BLOCK 8: INTERMEDIATE EXPRESSIONS (B1/B2)
  // ==================================================================================
  ["I am looking forward to it.", "Estou ansioso por isso.", "hard", "Feelings"],
  ["It's up to you.", "Você que sabe / Depende de você.", "medium", "Idioms"],
  ["Keep in touch.", "Mantenha contato.", "medium", "Social"],
  ["Let me know.", "Me avise.", "medium", "Social"],
  ["Make up your mind.", "Decida-se.", "hard", "Idioms"],
  ["Never mind.", "Deixa pra lá.", "medium", "Idioms"],
  ["So far so good.", "Até agora tudo bem.", "medium", "Idioms"],
  ["Take your time.", "Leve o tempo que precisar.", "medium", "Social"],
  ["What a pity!", "Que pena!", "medium", "Exclamations"],
  ["No way!", "De jeito nenhum!", "easy", "Exclamations"],
  
  // ==================================================================================
  // PHONETIC CHALLENGES
  // ==================================================================================
  ["Three thin thieves.", "Três ladrões magros.", "hard", "TH Sound"],
  ["World wide web.", "Rede mundial.", "hard", "W & R Sound"],
  ["Crisp crusts.", "Crosta crocante.", "hard", "Clusters"],
  ["Eleven elephants.", "Onze elefantes.", "hard", "V & L Sound"],
  ["Which witch is which?", "Qual bruxa é qual?", "hard", "W Sound"]
];

// Generate IDs dynamically based on the 1000 phrase goal structure
export const COMMON_PHRASES: Phrase[] = RAW_DATA.map((item, index) => ({
  id: `core-1k-${String(index + 1).padStart(4, '0')}`,
  english: item[0],
  portuguese: item[1],
  difficulty: item[2],
  category: item[3]
}));

export const getCoursePhrases = (startIndex: number, count: number): Phrase[] => {
  // Cycle through phrases if we reach the end to prevent crashes
  const safeIndex = startIndex % COMMON_PHRASES.length;
  // If request exceeds array bounds, loop back to start
  if (safeIndex + count > COMMON_PHRASES.length) {
    const end = COMMON_PHRASES.slice(safeIndex);
    const start = COMMON_PHRASES.slice(0, count - end.length);
    return [...end, ...start];
  }
  return COMMON_PHRASES.slice(safeIndex, safeIndex + count);
};

export const getRandomPhrases = (count: number): Phrase[] => {
    // Shuffle the array using the Fisher-Yates (or simple sort) method and pick 'count' items
    const shuffled = [...COMMON_PHRASES].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
};

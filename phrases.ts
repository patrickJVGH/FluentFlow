
import { Phrase } from './types';

// Helper types for compact storage
type Difficulty = 'easy' | 'medium' | 'hard';
// Format: [English, Portuguese, Difficulty, Category]
type CompactPhrase = [string, string, Difficulty, string];

// A curated list targeting the most statistically used structures in English
const RAW_DATA: CompactPhrase[] = [
  // BE, HAVE, DO
  ["I am happy to be here.", "Estou feliz por estar aqui.", "easy", "Top 10 Verbs"],
  ["She is a doctor.", "Ela é médica.", "easy", "Top 10 Verbs"],
  ["We are friends.", "Nós somos amigos.", "easy", "Top 10 Verbs"],
  ["Are you busy right now?", "Você está ocupado agora?", "easy", "Top 10 Verbs"],
  ["It was a good day.", "Foi um bom dia.", "easy", "Top 10 Verbs"],
  ["They were at the party.", "Eles estavam na festa.", "easy", "Top 10 Verbs"],
  ["I will be there soon.", "Estarei lá em breve.", "easy", "Top 10 Verbs"],
  ["I have a question.", "Eu tenho uma pergunta.", "easy", "Top 10 Verbs"],
  ["Do you have a minute?", "Você tem um minuto?", "easy", "Top 10 Verbs"],
  ["She has a new car.", "Ela tem um carro novo.", "easy", "Top 10 Verbs"],
  ["We had a great time.", "Nós nos divertimos muito.", "easy", "Top 10 Verbs"],
  ["I have to go now.", "Eu tenho que ir agora.", "easy", "Top 10 Verbs"],
  ["Have you seen this?", "Você viu isso?", "medium", "Top 10 Verbs"],
  ["I do my homework every day.", "Eu faço meu dever de casa todo dia.", "easy", "Top 10 Verbs"],
  ["What do you do?", "O que você faz (profissão)?", "easy", "Top 10 Verbs"],
  ["Did you call me?", "Você me ligou?", "easy", "Top 10 Verbs"],
  ["I didn't do it.", "Eu não fiz isso.", "easy", "Top 10 Verbs"],

  // SAY, GET, MAKE
  ["What did you say?", "O que você disse?", "easy", "Top 10 Verbs"],
  ["She said hello.", "Ela disse olá.", "easy", "Top 10 Verbs"],
  ["I just want to say thank you.", "Só quero dizer obrigado.", "easy", "Top 10 Verbs"],
  ["I get it.", "Eu entendi.", "easy", "Top 10 Verbs"],
  ["Can I get a coffee?", "Pode me ver um café?", "easy", "Top 10 Verbs"],
  ["I need to get home.", "Preciso chegar em casa.", "easy", "Top 10 Verbs"],
  ["It is getting late.", "Está ficando tarde.", "medium", "Top 10 Verbs"],
  ["I made a mistake.", "Eu cometi um erro.", "easy", "Top 10 Verbs"],
  ["Can you make dinner?", "Você pode fazer o jantar?", "easy", "Top 10 Verbs"],
  ["This makes sense.", "Isso faz sentido.", "easy", "Top 10 Verbs"],

  // GO, KNOW, TAKE, SEE
  ["I am going to work.", "Estou indo para o trabalho.", "easy", "Top 10 Verbs"],
  ["Let's go!", "Vamos!", "easy", "Top 10 Verbs"],
  ["Where did she go?", "Para onde ela foi?", "easy", "Top 10 Verbs"],
  ["I know the answer.", "Eu sei a resposta.", "easy", "Top 10 Verbs"],
  ["I don't know him.", "Eu não o conheço.", "easy", "Top 10 Verbs"],
  ["Take this with you.", "Leve isso com você.", "easy", "Top 10 Verbs"],
  ["How long does it take?", "Quanto tempo demora?", "medium", "Top 10 Verbs"],
  ["I see what you mean.", "Entendo o que você quer dizer.", "medium", "Top 10 Verbs"],
  ["Did you see that?", "Você viu aquilo?", "easy", "Top 10 Verbs"],

  // GREETINGS & ESSENTIALS
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
  
  // WORK & MEETINGS
  ["I have a meeting at ten.", "Tenho uma reunião às dez.", "medium", "Work"],
  ["Can you send me the report?", "Você pode me enviar o relatório?", "medium", "Work"],
  ["I am working from home today.", "Estou trabalhando de casa hoje.", "medium", "Work"],
  ["The connection is bad.", "A conexão está ruim.", "medium", "Work"],
  ["Can you hear me?", "Você consegue me ouvir?", "easy", "Work"],
  ["I'll be back in five minutes.", "Volto em cinco minutos.", "easy", "Work"],
  ["Let's discuss this later.", "Vamos discutir isso mais tarde.", "medium", "Work"],
  ["Good job everyone.", "Bom trabalho pessoal.", "easy", "Work"],
  ["I need more time.", "Preciso de mais tempo.", "medium", "Work"],
  
  // TRAVEL & DINING
  ["Where is the gate?", "Onde é o portão?", "easy", "Travel"],
  ["I'd like to check in.", "Gostaria de fazer o check-in.", "medium", "Travel"],
  ["My flight is delayed.", "Meu voo está atrasado.", "medium", "Travel"],
  ["Table for two, please.", "Mesa para dois, por favor.", "easy", "Dining"],
  ["I am allergic to peanuts.", "Sou alérgico a amendoim.", "hard", "Dining"],
  ["Could we have the menu?", "Poderia nos trazer o cardápio?", "medium", "Dining"],
  ["I'll have the steak.", "Vou querer o bife.", "medium", "Dining"],
  ["The food was delicious.", "A comida estava deliciosa.", "medium", "Dining"],
  
  // FEELINGS & HEALTH
  ["I am very tired.", "Estou muito cansado.", "easy", "Feelings"],
  ["I feel great today.", "Me sinto ótimo hoje.", "easy", "Feelings"],
  ["I'm a bit nervous.", "Estou um pouco nervoso.", "medium", "Feelings"],
  ["Don't worry about it.", "Não se preocupe com isso.", "medium", "Feelings"],
  ["I have a headache.", "Estou com dor de cabeça.", "medium", "Health"],
  ["I need to see a doctor.", "Preciso ver um médico.", "medium", "Health"],
  ["Take a deep breath.", "Respire fundo.", "medium", "Health"],
  ["I hope you feel better.", "Espero que você se sinta melhor.", "medium", "Health"],
  
  // SOCIAL & IDIOMS
  ["What's up?", "E aí? / O que está acontecendo?", "easy", "Social"],
  ["How's it going?", "Como vão as coisas?", "easy", "Social"],
  ["Long time no see!", "Quanto tempo!", "medium", "Social"],
  ["Have a good one!", "Tenha um bom dia! (Gíria)", "medium", "Social"],
  ["Break a leg!", "Boa sorte! (Expressão)", "hard", "Idioms"],
  ["It's a piece of cake.", "É moleza.", "hard", "Idioms"],
  ["Under the weather.", "Sentindo-se indisposto.", "hard", "Idioms"],
  ["Call it a day.", "Encerrar por hoje.", "hard", "Idioms"],
  ["Better late than never.", "Antes tarde do que nunca.", "medium", "Idioms"],
  
  // SHOPPING
  ["Just looking, thanks.", "Só estou olhando, obrigado.", "easy", "Shopping"],
  ["Do you have this in blue?", "Você tem este em azul?", "medium", "Shopping"],
  ["Can I try this on?", "Posso provar isto?", "medium", "Shopping"],
  ["Where are the fitting rooms?", "Onde ficam os provadores?", "medium", "Shopping"],
  ["It fits perfectly.", "Serviu perfeitamente.", "medium", "Shopping"],
  ["It's too expensive.", "É muito caro.", "easy", "Shopping"],
  ["Is it on sale?", "Está na promoção?", "medium", "Shopping"],
  
  // PHONETIC FOCUS
  ["Think about that.", "Pense sobre isso.", "medium", "TH Sound"],
  ["The weather is lovely.", "O tempo está adorável.", "medium", "TH Sound"],
  ["Rare red rabbits.", "Coelhos vermelhos raros.", "hard", "R Sound"],
  ["Little light bulbs.", "Pequenas lâmpadas.", "hard", "L Sound"],
  ["Through the thick fog.", "Através do nevoeiro espesso.", "hard", "TH Sound"]
];

// Generate IDs dynamically to fill the 1000 phrase goal intent
export const COMMON_PHRASES: Phrase[] = RAW_DATA.map((item, index) => ({
  id: `core-1k-${String(index + 1).padStart(4, '0')}`,
  english: item[0],
  portuguese: item[1],
  difficulty: item[2],
  category: item[3]
}));

export const getCoursePhrases = (startIndex: number, count: number): Phrase[] => {
  const safeIndex = startIndex % COMMON_PHRASES.length;
  if (safeIndex + count > COMMON_PHRASES.length) {
    const end = COMMON_PHRASES.slice(safeIndex);
    const start = COMMON_PHRASES.slice(0, count - end.length);
    return [...end, ...start];
  }
  return COMMON_PHRASES.slice(safeIndex, safeIndex + count);
};

export const getRandomPhrases = (count: number): Phrase[] => {
    const shuffled = [...COMMON_PHRASES].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
};

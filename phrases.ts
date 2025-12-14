
import { Phrase } from './types';

// Helper types for compact storage
type Difficulty = 'easy' | 'medium' | 'hard';
// Format: [English, Portuguese, Difficulty, Category]
type CompactPhrase = [string, string, Difficulty, string];

const RAW_DATA: CompactPhrase[] = [
  // ==================================================================================
  // LEVEL A1 - BEGINNER (Survival, Basic Interactions)
  // ==================================================================================
  // Greetings & Intros
  ["Hello, how are you?", "Olá, como você está?", "easy", "Greetings"],
  ["I'm fine, thanks.", "Estou bem, obrigado(a).", "easy", "Greetings"],
  ["Nice to meet you.", "Prazer em conhecer você.", "easy", "Greetings"],
  ["What is your name?", "Qual é o seu nome?", "easy", "Greetings"],
  ["My name is...", "Meu nome é...", "easy", "Greetings"],
  ["Where are you from?", "De onde você é?", "easy", "Greetings"],
  ["I am from Brazil.", "Eu sou do Brasil.", "easy", "Greetings"],
  ["See you later.", "Até mais tarde.", "easy", "Greetings"],
  ["Good morning.", "Bom dia.", "easy", "Greetings"],
  ["Good night.", "Boa noite.", "easy", "Greetings"],
  
  // Essentials
  ["Yes, please.", "Sim, por favor.", "easy", "Essentials"],
  ["No, thank you.", "Não, obrigado(a).", "easy", "Essentials"],
  ["I don't understand.", "Eu não entendo.", "easy", "Essentials"],
  ["I don't know.", "Eu não sei.", "easy", "Essentials"],
  ["Can you help me?", "Você pode me ajudar?", "easy", "Essentials"],
  ["Excuse me.", "Com licença.", "easy", "Essentials"],
  ["I am sorry.", "Desculpe-me.", "easy", "Essentials"],
  ["How much is this?", "Quanto custa isto?", "easy", "Essentials"],
  ["Where is the bathroom?", "Onde fica o banheiro?", "easy", "Essentials"],
  ["Do you speak English?", "Você fala inglês?", "easy", "Essentials"],
  ["Speak slower, please.", "Fale mais devagar, por favor.", "easy", "Essentials"],
  ["What time is it?", "Que horas são?", "easy", "Essentials"],
  
  // Travel & Directions
  ["I am lost.", "Estou perdido.", "easy", "Travel"],
  ["Where is the subway?", "Onde fica o metrô?", "easy", "Travel"],
  ["I need a taxi.", "Eu preciso de um táxi.", "easy", "Travel"],
  ["Is it far?", "É longe?", "easy", "Travel"],
  ["Go straight ahead.", "Vá direto em frente.", "easy", "Travel"],
  ["Turn left.", "Vire à esquerda.", "easy", "Travel"],
  ["Turn right.", "Vire à direita.", "easy", "Travel"],
  ["Stop here, please.", "Pare aqui, por favor.", "easy", "Travel"],
  ["I have a reservation.", "Eu tenho uma reserva.", "easy", "Travel"],
  ["My luggage is missing.", "Minha bagagem sumiu.", "easy", "Travel"],

  // Food & Dining
  ["I am hungry.", "Estou com fome.", "easy", "Dining"],
  ["I would like water.", "Eu gostaria de água.", "easy", "Dining"],
  ["A table for two.", "Uma mesa para dois.", "easy", "Dining"],
  ["The menu, please.", "O cardápio, por favor.", "easy", "Dining"],
  ["I am vegetarian.", "Eu sou vegetariano.", "easy", "Dining"],
  ["The check, please.", "A conta, por favor.", "easy", "Dining"],
  ["This is delicious.", "Isto está delicioso.", "easy", "Dining"],
  ["Do you have coffee?", "Você tem café?", "easy", "Dining"],
  ["No sugar, please.", "Sem açúcar, por favor.", "easy", "Dining"],
  
  // ==================================================================================
  // LEVEL A2 - ELEMENTARY (Routine, Shopping, Descriptions)
  // ==================================================================================
  // Daily Life
  ["I wake up at 7 AM.", "Eu acordo às 7 da manhã.", "easy", "Routine"],
  ["I go to work by bus.", "Vou para o trabalho de ônibus.", "easy", "Routine"],
  ["She likes to read books.", "Ela gosta de ler livros.", "easy", "Hobbies"],
  ["We watch TV every night.", "Nós assistimos TV toda noite.", "easy", "Routine"],
  ["It is raining today.", "Está chovendo hoje.", "easy", "Weather"],
  ["It is very hot outside.", "Está muito quente lá fora.", "easy", "Weather"],
  ["I am tired today.", "Estou cansado hoje.", "easy", "Feelings"],
  ["He is my brother.", "Ele é meu irmão.", "easy", "Family"],
  ["Do you have any siblings?", "Você tem irmãos?", "easy", "Family"],
  
  // Shopping
  ["Do you have this in blue?", "Você tem isso em azul?", "medium", "Shopping"],
  ["Can I try it on?", "Posso experimentar?", "medium", "Shopping"],
  ["It fits perfectly.", "Serve perfeitamente.", "medium", "Shopping"],
  ["It is too expensive.", "É muito caro.", "medium", "Shopping"],
  ["Do you accept credit cards?", "Você aceita cartão de crédito?", "medium", "Shopping"],
  ["I am just looking.", "Estou apenas olhando.", "medium", "Shopping"],
  ["What time do you close?", "Que horas vocês fecham?", "medium", "Shopping"],
  
  // Past Simple
  ["I went to the beach yesterday.", "Fui à praia ontem.", "medium", "Past Events"],
  ["Did you see the movie?", "Você viu o filme?", "medium", "Past Events"],
  ["We had a great time.", "Nós nos divertimos muito.", "medium", "Past Events"],
  ["I bought a new car.", "Comprei um carro novo.", "medium", "Past Events"],
  ["She didn't come to the party.", "Ela não veio para a festa.", "medium", "Past Events"],
  
  // ==================================================================================
  // LEVEL B1 - INTERMEDIATE (Opinions, Work, Future, Experiences)
  // ==================================================================================
  // Work & Career
  ["I work as a software engineer.", "Trabalho como engenheiro de software.", "medium", "Work"],
  ["I am looking for a job.", "Estou procurando emprego.", "medium", "Work"],
  ["Can we schedule a meeting?", "Podemos agendar uma reunião?", "medium", "Work"],
  ["I have a deadline to meet.", "Tenho um prazo a cumprir.", "medium", "Work"],
  ["Could you send me the report?", "Poderia me enviar o relatório?", "medium", "Work"],
  ["I am responsible for marketing.", "Sou responsável pelo marketing.", "medium", "Work"],
  
  // Opinions & Suggestions
  ["I think that is a good idea.", "Acho que é uma boa ideia.", "medium", "Opinions"],
  ["I don't agree with you.", "Não concordo com você.", "medium", "Opinions"],
  ["Maybe we should wait.", "Talvez devêssemos esperar.", "medium", "Suggestions"],
  ["It depends on the weather.", "Depende do clima.", "medium", "General"],
  ["In my opinion, it's too risky.", "Na minha opinião, é muito arriscado.", "medium", "Opinions"],
  ["Why don't we go out?", "Por que não saímos?", "medium", "Suggestions"],
  
  // Future & Experiences
  ["I am going to travel next month.", "Vou viajar no mês que vem.", "medium", "Future"],
  ["Have you ever been to Europe?", "Você já esteve na Europa?", "medium", "Experience"],
  ["I have never eaten sushi.", "Nunca comi sushi.", "medium", "Experience"],
  ["We will probably stay home.", "Provavelmente ficaremos em casa.", "medium", "Future"],
  ["I hope to see you soon.", "Espero te ver em breve.", "medium", "Future"],
  
  // Health
  ["I have a headache.", "Estou com dor de cabeça.", "medium", "Health"],
  ["I need to make an appointment.", "Preciso marcar uma consulta.", "medium", "Health"],
  ["I am feeling dizzy.", "Estou me sentindo tonto.", "medium", "Health"],
  ["Is it an emergency?", "É uma emergência?", "medium", "Health"],
  ["Take this medicine twice a day.", "Tome este remédio duas vezes ao dia.", "medium", "Health"],

  // ==================================================================================
  // LEVEL B2 - UPPER INTERMEDIATE (Phrasal Verbs, Idioms, Complex grammar)
  // ==================================================================================
  ["I am looking forward to it.", "Estou ansioso por isso.", "hard", "Feelings"],
  ["We need to come up with a plan.", "Precisamos bolar um plano.", "hard", "Phrasal Verbs"],
  ["She ran out of patience.", "A paciência dela acabou.", "hard", "Phrasal Verbs"],
  ["I can't put up with this noise.", "Não aguento esse barulho.", "hard", "Phrasal Verbs"],
  ["Please, carry on with your work.", "Por favor, continue com seu trabalho.", "hard", "Phrasal Verbs"],
  ["He didn't show up for the meeting.", "Ele não apareceu para a reunião.", "hard", "Phrasal Verbs"],
  ["I need to catch up on emails.", "Preciso colocar os e-mails em dia.", "hard", "Phrasal Verbs"],
  
  // Connectors & Conditions
  ["If I were you, I would accept.", "Se eu fosse você, eu aceitaria.", "hard", "Advice"],
  ["Unless we hurry, we will be late.", "A menos que corramos, vamos nos atrasar.", "hard", "Conditions"],
  ["Although it rained, we went out.", "Embora tenha chovido, nós saímos.", "hard", "Connectors"],
  ["However, I must disagree.", "No entanto, devo discordar.", "hard", "Connectors"],
  ["You should have told me.", "Você deveria ter me contado.", "hard", "Regrets"],
  
  // Business B2
  ["Let's wrap this up.", "Vamos encerrar isso.", "hard", "Business"],
  ["Keep me in the loop.", "Mantenha-me informado.", "hard", "Business"],
  ["We are on the same page.", "Estamos alinhados.", "hard", "Business"],
  ["It's not worth the effort.", "Não vale o esforço.", "hard", "Opinions"],
  ["I'd rather stay home.", "Prefiro ficar em casa.", "hard", "Preferences"],

  // ==================================================================================
  // LEVEL C1/C2 - ADVANCED (Idioms, Nuance, Mastery)
  // ==================================================================================
  ["It's a blessing in disguise.", "É um mal que veio para o bem.", "hard", "Idioms"],
  ["Don't beat around the bush.", "Não faça rodeios.", "hard", "Idioms"],
  ["He let the cat out of the bag.", "Ele deixou escapar o segredo.", "hard", "Idioms"],
  ["It costs an arm and a leg.", "Custa os olhos da cara.", "hard", "Idioms"],
  ["We'll cross that bridge when we come to it.", "Resolveremos isso quando chegar a hora.", "hard", "Idioms"],
  ["To be honest, I'm under the weather.", "Para ser honesto, não estou muito bem.", "hard", "Idioms"],
  ["You hit the nail on the head.", "Você acertou em cheio.", "hard", "Idioms"],
  ["It goes without saying.", "Não precisa nem dizer.", "hard", "Advanced"],
  ["I was blown away by the results.", "Fiquei impressionado com os resultados.", "hard", "Advanced"],
  ["Let's call it a day.", "Vamos encerrar por hoje.", "hard", "Idioms"],
  ["It slipped my mind completely.", "Esqueci completamente.", "hard", "Memory"],
  ["That ship has sailed.", "A oportunidade já passou.", "hard", "Idioms"],
  ["He is the breadwinner.", "Ele é quem sustenta a casa.", "hard", "Advanced"],
  ["Play it by ear.", "Vamos improvisar/ver na hora.", "hard", "Idioms"],
  ["Bite the bullet.", "Encarar a situação difícil.", "hard", "Idioms"],

  // ==================================================================================
  // PHONETIC CHALLENGES (Pronunciation Mastery)
  // ==================================================================================
  ["Three thin thieves thought.", "Três ladrões magros pensaram.", "hard", "TH Sound"],
  ["Red lorry, yellow lorry.", "Caminhão vermelho, caminhão amarelo.", "hard", "R & L Sound"],
  ["She sells seashells by the seashore.", "Ela vende conchas à beira-mar.", "hard", "S & SH Sound"],
  ["I thought about the weather.", "Pensei sobre o clima.", "hard", "TH Voiced/Unvoiced"],
  ["The thirty-three thieves.", "Os trinta e três ladrões.", "hard", "TH Sound"],
  ["World wide web.", "Rede mundial de computadores.", "hard", "W & R Sound"],
  ["Crisp crusts crackle crunchily.", "Crosta crocante estala.", "hard", "Cluster Sounds"],
  ["A proper cup of coffee.", "Uma xícara de café adequada.", "hard", "P & F Sound"],
  ["Eleven benevolent elephants.", "Onze elefantes benevolentes.", "hard", "V & L Sound"],
  ["Truly rural.", "Verdadeiramente rural.", "hard", "R Sound"]
];

// Generate IDs dynamically
export const COMMON_PHRASES: Phrase[] = RAW_DATA.map((item, index) => ({
  id: `phrase-${String(index + 1).padStart(4, '0')}`,
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

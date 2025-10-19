 Google GenAI SDK'ya geçiş

2024'ün sonlarında Gemini 2.0 sürümüyle birlikte Google GenAI SDK adlı yeni bir kitaplık grubu kullanıma sunuldu. Güncellenmiş istemci mimarisi sayesinde geliştirici deneyimini iyileştirir ve geliştirici ile kurumsal iş akışları arasındaki geçişi kolaylaştırır.

Google Üretken Yapay Zeka SDK'sı artık desteklenen tüm platformlarda genel kullanıma sunulmuştur. Eski kitaplıklarımızdan birini kullanıyorsanız geçiş yapmanızı önemle tavsiye ederiz.

Bu kılavuzda, kullanmaya başlamanıza yardımcı olmak için taşınan kodun öncesi ve sonrası örnekleri verilmiştir.

Not: Go örneklerinde okunabilirliği artırmak için içe aktarmalar ve diğer standart kodlar çıkarılmıştır.
Kurulum
Önce

Python
JavaScript
Go

npm install @google/generative-ai
Sonra

Python
JavaScript
Go

npm install @google/genai
API erişimi
Eski SDK, çeşitli geçici yöntemler kullanarak API istemcisini arka planda örtülü olarak işliyordu. Bu durum, istemciyi ve kimlik bilgilerini yönetmeyi zorlaştırıyordu. Artık merkezi bir Client nesnesi üzerinden etkileşimde bulunursunuz. Bu Client nesnesi, çeşitli API hizmetleri (ör. models, chats, files, tunings) kullanarak tutarlılığı artırır ve farklı API çağrıları arasında kimlik bilgisi ve yapılandırma yönetimini basitleştirir.

Öncesi (Daha Az Merkezi API Erişimi)

Python
JavaScript
Go
GoogleGenerativeAI, modeller ve sohbet için merkezi bir nokta olsa da dosya ve önbellek yönetimi gibi diğer işlevler genellikle tamamen ayrı istemci sınıflarının içe aktarılmasını ve oluşturulmasını gerektiriyordu.


import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager, GoogleAICacheManager } from "@google/generative-ai/server"; // For files/caching

const genAI = new GoogleGenerativeAI("YOUR_API_KEY");
const fileManager = new GoogleAIFileManager("YOUR_API_KEY");
const cacheManager = new GoogleAICacheManager("YOUR_API_KEY");

// Get a model instance, then call methods on it
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const result = await model.generateContent(...);
const chat = model.startChat(...);

// Call methods on separate client objects for other services
const uploadedFile = await fileManager.uploadFile(...);
const cache = await cacheManager.create(...);
Sonra (Merkezi Müşteri Nesnesi)

Python
JavaScript
Go

import { GoogleGenAI } from "@google/genai";

// Create a single client object
const ai = new GoogleGenAI({apiKey: "YOUR_API_KEY"});

// Access API methods through services on the client object
const response = await ai.models.generateContent(...);
const chat = ai.chats.create(...);
const uploadedFile = await ai.files.upload(...);
const cache = await ai.caches.create(...);
Kimlik doğrulama
Hem eski hem de yeni kitaplıklar, API anahtarları kullanılarak kimlik doğrular. API anahtarınızı Google AI Studio'da oluşturabilirsiniz.

Önce

Python
JavaScript
Go

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI("GOOGLE_API_KEY");
Sonra

Python
JavaScript
Go

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({apiKey: "GEMINI_API_KEY"});
İçerik oluşturma
Metin
Önce

Python
JavaScript
Go

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const prompt = "Tell me a story in 300 words";

const result = await model.generateContent(prompt);
console.log(result.response.text());
Sonra

Python
JavaScript
Go

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "GOOGLE_API_KEY" });

const response = await ai.models.generateContent({
  model: "gemini-2.0-flash",
  contents: "Tell me a story in 300 words.",
});
console.log(response.text);
Resim
Önce

Python
JavaScript
Go

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI("GOOGLE_API_KEY");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

function fileToGenerativePart(path, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(path)).toString("base64"),
      mimeType,
    },
  };
}

const prompt = "Tell me a story based on this image";

const imagePart = fileToGenerativePart(
  `path/to/organ.jpg`,
  "image/jpeg",
);

const result = await model.generateContent([prompt, imagePart]);
console.log(result.response.text());
Sonra

Python
JavaScript
Go

import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({ apiKey: "GOOGLE_API_KEY" });

const organ = await ai.files.upload({
  file: "path/to/organ.jpg",
});

const response = await ai.models.generateContent({
  model: "gemini-2.0-flash",
  contents: [
    createUserContent([
      "Tell me a story based on this image",
      createPartFromUri(organ.uri, organ.mimeType)
    ]),
  ],
});
console.log(response.text);
Canlı Yayın
Önce

Python
JavaScript
Go

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI("GOOGLE_API_KEY");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const prompt = "Write a story about a magic backpack.";

const result = await model.generateContentStream(prompt);

// Print text as it comes in.
for await (const chunk of result.stream) {
  const chunkText = chunk.text();
  process.stdout.write(chunkText);
}
Sonra

Python
JavaScript
Go

import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({ apiKey: "GOOGLE_API_KEY" });

const response = await ai.models.generateContentStream({
  model: "gemini-2.0-flash",
  contents: "Write a story about a magic backpack.",
});
let text = "";
for await (const chunk of response) {
  console.log(chunk.text);
  text += chunk.text;
}
Yapılandırma
Önce

Python
JavaScript
Go

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI("GOOGLE_API_KEY");
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  generationConfig: {
    candidateCount: 1,
    stopSequences: ["x"],
    maxOutputTokens: 20,
    temperature: 1.0,
  },
});

const result = await model.generateContent(
  "Tell me a story about a magic backpack.",
);
console.log(result.response.text())
Sonra

Python
JavaScript
Go

import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({ apiKey: "GOOGLE_API_KEY" });

const response = await ai.models.generateContent({
  model: "gemini-2.0-flash",
  contents: "Tell me a story about a magic backpack.",
  config: {
    candidateCount: 1,
    stopSequences: ["x"],
    maxOutputTokens: 20,
    temperature: 1.0,
  },
});

console.log(response.text);
Güvenlik ayarları
Güvenlik ayarlarıyla yanıt oluşturma:

Önce

Python
JavaScript

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI("GOOGLE_API_KEY");
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
    },
  ],
});

const unsafePrompt =
  "I support Martians Soccer Club and I think " +
  "Jupiterians Football Club sucks! Write an ironic phrase telling " +
  "them how I feel about them.";

const result = await model.generateContent(unsafePrompt);

try {
  result.response.text();
} catch (e) {
  console.error(e);
  console.log(result.response.candidates[0].safetyRatings);
}
Sonra

Python
JavaScript

import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({ apiKey: "GOOGLE_API_KEY" });
const unsafePrompt =
  "I support Martians Soccer Club and I think " +
  "Jupiterians Football Club sucks! Write an ironic phrase telling " +
  "them how I feel about them.";

const response = await ai.models.generateContent({
  model: "gemini-2.0-flash",
  contents: unsafePrompt,
  config: {
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_ONLY_HIGH",
      },
    ],
  },
});

console.log("Finish reason:", response.candidates[0].finishReason);
console.log("Safety ratings:", response.candidates[0].safetyRatings);
Asenk.
Önce

Python

import google.generativeai as genai

model = genai.GenerativeModel('gemini-1.5-flash')
response = model.generate_content_async(
    'tell me a story in 100 words'
)
Sonra

Python
Yeni SDK'yı asyncio ile kullanmak için client.aio altındaki her yöntemin ayrı bir async uygulaması vardır.


from google import genai

client = genai.Client()

response = await client.aio.models.generate_content(
    model='gemini-2.0-flash',
    contents='Tell me a story in 300 words.'
)
Sohbet
Sohbet başlatma ve modele mesaj gönderme:

Önce

Python
JavaScript
Go

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI("GOOGLE_API_KEY");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const chat = model.startChat({
  history: [
    {
      role: "user",
      parts: [{ text: "Hello" }],
    },
    {
      role: "model",
      parts: [{ text: "Great to meet you. What would you like to know?" }],
    },
  ],
});
let result = await chat.sendMessage("I have 2 dogs in my house.");
console.log(result.response.text());
result = await chat.sendMessage("How many paws are in my house?");
console.log(result.response.text());
Sonra

Python
JavaScript
Go

import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({ apiKey: "GOOGLE_API_KEY" });
const chat = ai.chats.create({
  model: "gemini-2.0-flash",
  history: [
    {
      role: "user",
      parts: [{ text: "Hello" }],
    },
    {
      role: "model",
      parts: [{ text: "Great to meet you. What would you like to know?" }],
    },
  ],
});

const response1 = await chat.sendMessage({
  message: "I have 2 dogs in my house.",
});
console.log("Chat response 1:", response1.text);

const response2 = await chat.sendMessage({
  message: "How many paws are in my house?",
});
console.log("Chat response 2:", response2.text);
İşlev çağırma
Önce

Python

import google.generativeai as genai
from enum import Enum

def get_current_weather(location: str) -> str:
    """Get the current whether in a given location.

    Args:
        location: required, The city and state, e.g. San Franciso, CA
        unit: celsius or fahrenheit
    """
    print(f'Called with: {location=}')
    return "23C"

model = genai.GenerativeModel(
    model_name="gemini-1.5-flash",
    tools=[get_current_weather]
)

response = model.generate_content("What is the weather in San Francisco?")
function_call = response.candidates[0].parts[0].function_call
Sonra

Python
Yeni SDK'da otomatik işlev çağırma varsayılandır. Burada devre dışı bırakın.


from google import genai
from google.genai import types

client = genai.Client()

def get_current_weather(location: str) -> str:
    """Get the current whether in a given location.

    Args:
        location: required, The city and state, e.g. San Franciso, CA
        unit: celsius or fahrenheit
    """
    print(f'Called with: {location=}')
    return "23C"

response = client.models.generate_content(
  model='gemini-2.0-flash',
  contents="What is the weather like in Boston?",
  config=types.GenerateContentConfig(
      tools=[get_current_weather],
      automatic_function_calling={'disable': True},
  ),
)

function_call = response.candidates[0].content.parts[0].function_call
Otomatik işlev çağırma
Önce

Python
Eski SDK yalnızca sohbette otomatik işlev çağrısını destekler. Yeni SDK'da bu, generate_content için varsayılan davranıştır.


import google.generativeai as genai

def get_current_weather(city: str) -> str:
    return "23C"

model = genai.GenerativeModel(
    model_name="gemini-1.5-flash",
    tools=[get_current_weather]
)

chat = model.start_chat(
    enable_automatic_function_calling=True)
result = chat.send_message("What is the weather in San Francisco?")
Sonra

Python

from google import genai
from google.genai import types
client = genai.Client()

def get_current_weather(city: str) -> str:
    return "23C"

response = client.models.generate_content(
  model='gemini-2.0-flash',
  contents="What is the weather like in Boston?",
  config=types.GenerateContentConfig(
      tools=[get_current_weather]
  ),
)
Kod yürütme
Kod yürütme, modelin Python kodu oluşturmasına, bu kodu çalıştırmasına ve sonucu döndürmesine olanak tanıyan bir araçtır.

Önce

Python
JavaScript

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI("GOOGLE_API_KEY");
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  tools: [{ codeExecution: {} }],
});

const result = await model.generateContent(
  "What is the sum of the first 50 prime numbers? " +
    "Generate and run code for the calculation, and make sure you get " +
    "all 50.",
);

console.log(result.response.text());
Sonra

Python
JavaScript

import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({ apiKey: "GOOGLE_API_KEY" });

const response = await ai.models.generateContent({
  model: "gemini-2.0-pro-exp-02-05",
  contents: `Write and execute code that calculates the sum of the first 50 prime numbers.
            Ensure that only the executable code and its resulting output are generated.`,
});

// Each part may contain text, executable code, or an execution result.
for (const part of response.candidates[0].content.parts) {
  console.log(part);
  console.log("\n");
}

console.log("-".repeat(80));
// The `.text` accessor concatenates the parts into a markdown-formatted text.
console.log("\n", response.text);
Arama temellendirme
GoogleSearch (Gemini>=2.0) ve GoogleSearchRetrieval (Gemini < 2.0), Google tarafından desteklenen ve modelin temel oluşturma için herkese açık web verilerini almasına olanak tanıyan araçlardır.

Önce

Python

import google.generativeai as genai

model = genai.GenerativeModel('gemini-1.5-flash')
response = model.generate_content(
    contents="what is the Google stock price?",
    tools='google_search_retrieval'
)
Sonra

Python

from google import genai
from google.genai import types

client = genai.Client()

response = client.models.generate_content(
    model='gemini-2.0-flash',
    contents='What is the Google stock price?',
    config=types.GenerateContentConfig(
        tools=[
            types.Tool(
                google_search=types.GoogleSearch()
            )
        ]
    )
)
JSON yanıtı
Yanıtları JSON biçiminde oluştur.

Önce

Python
JavaScript

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI("GOOGLE_API_KEY");

const schema = {
  description: "List of recipes",
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      recipeName: {
        type: SchemaType.STRING,
        description: "Name of the recipe",
        nullable: false,
      },
    },
    required: ["recipeName"],
  },
};

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-pro",
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: schema,
  },
});

const result = await model.generateContent(
  "List a few popular cookie recipes.",
);
console.log(result.response.text());
Sonra

Python
JavaScript

import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({ apiKey: "GOOGLE_API_KEY" });
const response = await ai.models.generateContent({
  model: "gemini-2.0-flash",
  contents: "List a few popular cookie recipes.",
  config: {
    responseMimeType: "application/json",
    responseSchema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          recipeName: { type: "string" },
          ingredients: { type: "array", items: { type: "string" } },
        },
        required: ["recipeName", "ingredients"],
      },
    },
  },
});
console.log(response.text);
Dosyalar
Yükleyin
Dosya yükleme:

Önce

Python

import requests
import pathlib
import google.generativeai as genai

# Download file
response = requests.get(
    'https://storage.googleapis.com/generativeai-downloads/data/a11.txt')
pathlib.Path('a11.txt').write_text(response.text)

file = genai.upload_file(path='a11.txt')

model = genai.GenerativeModel('gemini-1.5-flash')
response = model.generate_content([
    'Can you summarize this file:',
    my_file
])
print(response.text)
Sonra

Python

import requests
import pathlib
from google import genai

client = genai.Client()

# Download file
response = requests.get(
    'https://storage.googleapis.com/generativeai-downloads/data/a11.txt')
pathlib.Path('a11.txt').write_text(response.text)

my_file = client.files.upload(file='a11.txt')

response = client.models.generate_content(
    model='gemini-2.0-flash',
    contents=[
        'Can you summarize this file:',
        my_file
    ]
)
print(response.text)
Listeleme ve edinme
Yüklenen dosyaları listeleme ve dosya adıyla yüklenen bir dosyayı alma:

Önce

Python

import google.generativeai as genai

for file in genai.list_files():
  print(file.name)

file = genai.get_file(name=file.name)
Sonra

Python

from google import genai
client = genai.Client()

for file in client.files.list():
    print(file.name)

file = client.files.get(name=file.name)
Sil
Dosya silme:

Önce

Python

import pathlib
import google.generativeai as genai

pathlib.Path('dummy.txt').write_text(dummy)
dummy_file = genai.upload_file(path='dummy.txt')

file = genai.delete_file(name=dummy_file.name)
Sonra

Python

import pathlib
from google import genai

client = genai.Client()

pathlib.Path('dummy.txt').write_text(dummy)
dummy_file = client.files.upload(file='dummy.txt')

response = client.files.delete(name=dummy_file.name)
Bağlamı önbelleğe alma
Bağlamı önbelleğe alma özelliği, kullanıcının içeriği modele bir kez iletmesine, giriş jetonlarını önbelleğe almasına ve ardından maliyeti düşürmek için sonraki çağrılarda önbelleğe alınan jetonlara başvurmasına olanak tanır.

Önce

Python
JavaScript

import { GoogleAICacheManager, GoogleAIFileManager } from "@google/generative-ai/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const cacheManager = new GoogleAICacheManager("GOOGLE_API_KEY");
const fileManager = new GoogleAIFileManager("GOOGLE_API_KEY");

const uploadResult = await fileManager.uploadFile("path/to/a11.txt", {
  mimeType: "text/plain",
});

const cacheResult = await cacheManager.create({
  model: "models/gemini-1.5-flash",
  contents: [
    {
      role: "user",
      parts: [
        {
          fileData: {
            fileUri: uploadResult.file.uri,
            mimeType: uploadResult.file.mimeType,
          },
        },
      ],
    },
  ],
});

console.log(cacheResult);

const genAI = new GoogleGenerativeAI("GOOGLE_API_KEY");
const model = genAI.getGenerativeModelFromCachedContent(cacheResult);
const result = await model.generateContent(
  "Please summarize this transcript.",
);
console.log(result.response.text());
Sonra

Python
JavaScript

import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({ apiKey: "GOOGLE_API_KEY" });
const filePath = path.join(media, "a11.txt");
const document = await ai.files.upload({
  file: filePath,
  config: { mimeType: "text/plain" },
});
console.log("Uploaded file name:", document.name);
const modelName = "gemini-1.5-flash";

const contents = [
  createUserContent(createPartFromUri(document.uri, document.mimeType)),
];

const cache = await ai.caches.create({
  model: modelName,
  config: {
    contents: contents,
    systemInstruction: "You are an expert analyzing transcripts.",
  },
});
console.log("Cache created:", cache);

const response = await ai.models.generateContent({
  model: modelName,
  contents: "Please summarize this transcript",
  config: { cachedContent: cache.name },
});
console.log("Response text:", response.text);
Parça sayma
Bir istekteki jeton sayısını hesaplar.

Önce

Python
JavaScript

 import { GoogleGenerativeAI } from "@google/generative-ai";

 const genAI = new GoogleGenerativeAI("GOOGLE_API_KEY+);
 const model = genAI.getGenerativeModel({
   model: "gemini-1.5-flash",
 });

 // Count tokens in a prompt without calling text generation.
 const countResult = await model.countTokens(
   "The quick brown fox jumps over the lazy dog.",
 );

 console.log(countResult.totalTokens); // 11

 const generateResult = await model.generateContent(
   "The quick brown fox jumps over the lazy dog.",
 );

 // On the response for `generateContent`, use `usageMetadata`
 // to get separate input and output token counts
 // (`promptTokenCount` and `candidatesTokenCount`, respectively),
 // as well as the combined token count (`totalTokenCount`).
 console.log(generateResult.response.usageMetadata);
 // candidatesTokenCount and totalTokenCount depend on response, may vary
 // { promptTokenCount: 11, candidatesTokenCount: 124, totalTokenCount: 135 }
Sonra

Python
JavaScript

import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({ apiKey: "GOOGLE_API_KEY" });
const prompt = "The quick brown fox jumps over the lazy dog.";
const countTokensResponse = await ai.models.countTokens({
  model: "gemini-2.0-flash",
  contents: prompt,
});
console.log(countTokensResponse.totalTokens);

const generateResponse = await ai.models.generateContent({
  model: "gemini-2.0-flash",
  contents: prompt,
});
console.log(generateResponse.usageMetadata);
Resimleri oluştur
Resim oluşturma:

Önce

Python

#pip install https://github.com/google-gemini/generative-ai-python@imagen
import google.generativeai as genai

imagen = genai.ImageGenerationModel(
    "imagen-3.0-generate-001")
gen_images = imagen.generate_images(
    prompt="Robot holding a red skateboard",
    number_of_images=1,
    safety_filter_level="block_low_and_above",
    person_generation="allow_adult",
    aspect_ratio="3:4",
)
Sonra

Python

from google import genai

client = genai.Client()

gen_images = client.models.generate_images(
    model='imagen-3.0-generate-001',
    prompt='Robot holding a red skateboard',
    config=types.GenerateImagesConfig(
        number_of_images= 1,
        safety_filter_level= "BLOCK_LOW_AND_ABOVE",
        person_generation= "ALLOW_ADULT",
        aspect_ratio= "3:4",
    )
)

for n, image in enumerate(gen_images.generated_images):
    pathlib.Path(f'{n}.png').write_bytes(
        image.image.image_bytes)
İçerik yerleştirme
İçerik yerleştirmeleri oluşturma

Önce

Python
JavaScript

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI("GOOGLE_API_KEY");
const model = genAI.getGenerativeModel({
  model: "gemini-embedding-001",
});

const result = await model.embedContent("Hello world!");

console.log(result.embedding);
Sonra

Python
JavaScript

import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({ apiKey: "GOOGLE_API_KEY" });
const text = "Hello World!";
const result = await ai.models.embedContent({
  model: "gemini-embedding-001",
  contents: text,
  config: { outputDimensionality: 10 },
});
console.log(result.embeddings);
Modelde ince ayar yapma
İnce ayarlı bir model oluşturma ve kullanma

Yeni SDK, client.tunings.tune ile ayarlamayı kolaylaştırır. Bu işlev, ayarlama işini başlatır ve iş tamamlanana kadar yoklama yapar.

Önce

Python

import google.generativeai as genai
import random

# create tuning model
train_data = {}
for i in range(1, 6):
  key = f'input {i}'
  value = f'output {i}'
  train_data[key] = value

name = f'generate-num-{random.randint(0,10000)}'
operation = genai.create_tuned_model(
    source_model='models/gemini-1.5-flash-001-tuning',
    training_data=train_data,
    id = name,
    epoch_count = 5,
    batch_size=4,
    learning_rate=0.001,
)
# wait for tuning complete
tuningProgress = operation.result()

# generate content with the tuned model
model = genai.GenerativeModel(model_name=f'tunedModels/{name}')
response = model.generate_content('55')
Sonra

Python

from google import genai
from google.genai import types

client = genai.Client()

# Check which models are available for tuning.
for m in client.models.list():
  for action in m.supported_actions:
    if action == "createTunedModel":
      print(m.name)
      break

# create tuning model
training_dataset=types.TuningDataset(
        examples=[
            types.TuningExample(
                text_input=f'input {i}',
                output=f'output {i}',
            )
            for i in range(5)
        ],
    )
tuning_job = client.tunings.tune(
    base_model='models/gemini-1.5-flash-001-tuning',
    training_dataset=training_dataset,
    config=types.CreateTuningJobConfig(
        epoch_count= 5,
        batch_size=4,
        learning_rate=0.001,
        tuned_model_display_name="test tuned model"
    )
)

# generate content with the tuned model
response = client.models.generate_content(
    model=tuning_job.tuned_model.model,
    contents='55',
)Sorun giderme kılavuzu

Gemini API'yi çağırırken ortaya çıkan yaygın sorunları teşhis edip çözmenize yardımcı olması için bu kılavuzu kullanın. Gemini API arka uç hizmeti veya istemci SDK'larından kaynaklanan sorunlarla karşılaşabilirsiniz. İstemci SDK'larımız aşağıdaki depolarda açık kaynaklıdır:

python-genai
js-genai
go-genai
API anahtarıyla ilgili sorunlarla karşılaşırsanız API anahtarı kurulum kılavuzuna göre API anahtarınızı doğru şekilde ayarladığınızı doğrulayın.

Gemini API arka uç hizmeti hata kodları
Aşağıdaki tabloda, karşılaşabileceğiniz yaygın arka uç hata kodları, bunların nedenlerine ilişkin açıklamalar ve sorun giderme adımları listelenmiştir:

HTTP Kodu	Durum	Açıklama	Örnek	Çözüm
400	INVALID_ARGUMENT	İstek metni yanlış biçimlendirilmiş.	İsteğinizde yazım hatası var veya zorunlu bir alan eksik.	İstek biçimi, örnekler ve desteklenen sürümler için API referansına bakın. Daha yeni bir API sürümündeki özellikleri daha eski bir uç nokta ile kullanmak hatalara neden olabilir.
400	FAILED_PRECONDITION	Gemini API ücretsiz katmanı ülkenizde kullanılamıyor. Lütfen Google AI Studio'da projenizde faturalandırmayı etkinleştirin.	Ücretsiz katmanın desteklenmediği bir bölgede istekte bulunuyorsunuz ve Google AI Studio'da projenizde faturalandırmayı etkinleştirmediniz.	Gemini API'yi kullanmak için Google AI Studio'yu kullanarak ücretli bir plan oluşturmanız gerekir.
403	PERMISSION_DENIED	API anahtarınız gerekli izinlere sahip değil.	Yanlış API anahtarını kullanıyorsunuz veya uygun kimlik doğrulama işleminden geçmeden ayarlanmış bir modeli kullanmaya çalışıyorsunuz.	API anahtarınızın ayarlandığından ve doğru erişime sahip olduğundan emin olun. Ayrıca, ince ayarlı modelleri kullanmak için uygun kimlik doğrulama sürecinden geçtiğinizden emin olun.
404	NOT_FOUND	İstenen kaynak bulunamadı.	İsteğinizde referans verilen bir resim, ses veya video dosyası bulunamadı.	İsteğinizdeki tüm parametrelerin API sürümünüz için geçerli olup olmadığını kontrol edin.
429	RESOURCE_EXHAUSTED	Hız sınırını aştınız.	Ücretsiz katman Gemini API ile dakika başına çok fazla istek gönderiyorsunuz.	Modelin hız sınırını aşmadığınızı doğrulayın. Gerekirse kota artışı isteyin.
500	DAHİLİ	Google'dan kaynaklanan beklenmeyen bir hata oluştu.	Giriş bağlamınız çok uzun.	Giriş bağlamınızı azaltın veya geçici olarak başka bir modele (ör. Gemini 1.5 Pro'dan Gemini 1.5 Flash'e) geçip sorunun çözülüp çözülmediğini kontrol edin. Dilerseniz biraz bekleyip isteğinizi yeniden deneyebilirsiniz. Yeniden denedikten sonra sorun devam ederse lütfen Google AI Studio'daki Geri bildirim gönder düğmesini kullanarak sorunu bildirin.
503	UNAVAILABLE	Hizmet geçici olarak aşırı yüklü veya kapalı olabilir.	Hizmetin kapasitesi geçici olarak tükeniyor.	Geçici olarak başka bir modele (ör. Gemini 1.5 Pro'dan Gemini 1.5 Flash'e) geçip çalışıp çalışmadığını kontrol edin. Dilerseniz biraz bekleyip isteğinizi yeniden deneyebilirsiniz. Yeniden denedikten sonra sorun devam ederse lütfen Google AI Studio'daki Geri bildirim gönder düğmesini kullanarak sorunu bildirin.
504	DEADLINE_EXCEEDED	Hizmet, işleme işlemini son tarihe kadar tamamlayamıyor.	İsteminiz (veya bağlamınız), zamanında işlenemeyecek kadar büyük.	Bu hatayı önlemek için istemci isteğinizde daha büyük bir "zaman aşımı" ayarlayın.
Model parametresi hataları için API çağrılarınızı kontrol etme
Model parametrelerinizin aşağıdaki değerler içinde olduğunu doğrulayın:

Model parametresi	Değerler (aralık)
Aday sayısı	1-8 (tam sayı)
Sıcaklık	0,0-1,0
Maksimum çıkış jetonu sayısı	Kullandığınız modelin maksimum jeton sayısını belirlemek için get_model (Python) kullanın.
TopP	0,0-1,0
Parametre değerlerini kontrol etmenin yanı sıra doğru API sürümünü (ör. /v1 veya /v1beta) ve ihtiyacınız olan özellikleri destekleyen bir model. Örneğin, bir özellik beta sürümündeyse yalnızca /v1beta API sürümünde kullanılabilir.

Doğru modele sahip olup olmadığınızı kontrol edin
Modeller sayfamızda listelenen desteklenen bir modeli kullandığınızı doğrulayın.

2.5 modellerinde daha yüksek gecikme süresi veya jeton kullanımı
2.5 Flash ve Pro modellerinde daha yüksek gecikme veya jeton kullanımı gözlemliyorsanız bunun nedeni, kaliteyi artırmak için düşünme özelliğinin varsayılan olarak etkinleştirilmiş olması olabilir. Hıza öncelik veriyorsanız veya maliyetleri en aza indirmeniz gerekiyorsa düşünme sürecini ayarlayabilir ya da devre dışı bırakabilirsiniz.

Yol gösterici bilgiler ve örnek kod için düşünme sayfasına bakın.

Güvenlik sorunları
API çağrınızdaki bir güvenlik ayarı nedeniyle istemin engellendiğini görürseniz istemi, API çağrısında ayarladığınız filtrelere göre inceleyin.

BlockedReason.OTHER simgesini görüyorsanız sorgu veya yanıt, Hizmet Şartları'nı ihlal ediyor ya da başka bir şekilde desteklenmiyor olabilir.

Okuma sorunu
Modelin, RECITATION (Tekrar) nedeniyle çıkış oluşturmayı durdurduğunu görüyorsanız bu, model çıkışının belirli verilere benzeyebileceği anlamına gelir. Bu sorunu düzeltmek için istemi / bağlamı mümkün olduğunca benzersiz hale getirmeyi ve daha yüksek bir sıcaklık kullanmayı deneyin.

Tekrarlanan jeton sorunu
Çıkış jetonlarının tekrarlandığını görüyorsanız bunları azaltmak veya tamamen ortadan kaldırmak için aşağıdaki önerileri deneyin.

Açıklama	Neden	Önerilen geçici çözüm
Markdown tablolarında tekrarlanan tireler	Model, görsel olarak hizalanmış bir Markdown tablosu oluşturmaya çalışırken tablonun içeriği uzun olduğunda bu durum ortaya çıkabilir. Ancak Markdown'da doğru oluşturma için hizalama gerekli değildir.	
İsteminizde, modele Markdown tabloları oluşturmayla ilgili belirli yönergeler verecek talimatlar ekleyin. Bu yönergelere uygun örnekler verin. Sıcaklığı ayarlamayı da deneyebilirsiniz. Kod oluşturma veya Markdown tabloları gibi çok yapılandırılmış çıkışlar için yüksek sıcaklık değerlerinin daha iyi sonuç verdiği görülmüştür (>= 0,8).

Bu sorunu önlemek için isteminize ekleyebileceğiniz örnek yönergeler aşağıda verilmiştir:


          # Markdown Table Format
          
          * Separator line: Markdown tables must include a separator line below
            the header row. The separator line must use only 3 hyphens per
            column, for example: |---|---|---|. Using more hypens like
            ----, -----, ------ can result in errors. Always
            use |:---|, |---:|, or |---| in these separator strings.

            For example:

            | Date | Description | Attendees |
            |---|---|---|
            | 2024-10-26 | Annual Conference | 500 |
            | 2025-01-15 | Q1 Planning Session | 25 |

          * Alignment: Do not align columns. Always use |---|.
            For three columns, use |---|---|---| as the separator line.
            For four columns use |---|---|---|---| and so on.

          * Conciseness: Keep cell content brief and to the point.

          * Never pad column headers or other cells with lots of spaces to
            match with width of other content. Only a single space on each side
            is needed. For example, always do "| column name |" instead of
            "| column name                |". Extra spaces are wasteful.
            A markdown renderer will automatically take care displaying
            the content in a visually appealing form.
        
Markdown tablolarında tekrarlanan jetonlar	Tekrarlanan tirelere benzer şekilde, bu durum modelin tablonun içeriğini görsel olarak hizalamaya çalışmasıyla ortaya çıkar. Doğru oluşturma için Markdown'da hizalama gerekmez.	
Sistem isteminize aşağıdaki gibi talimatlar eklemeyi deneyin:

            FOR TABLE HEADINGS, IMMEDIATELY ADD ' |' AFTER THE TABLE HEADING.
          
Sıcaklığı ayarlamayı deneyin. Daha yüksek sıcaklıklar (>= 0,8), çıkıştaki tekrarları veya kopyaları genellikle ortadan kaldırmaya yardımcı olur.
Yapılandırılmış çıkışta tekrar eden yeni satırlar (\n)	Model girişi, \u veya \t gibi Unicode ya da kaçış dizileri içerdiğinde tekrarlanan yeni satırlara yol açabilir.	
İsteminizde yasaklanmış kaçış dizilerini UTF-8 karakterleriyle değiştirin. Örneğin, JSON örneklerinizdeki \u kaçış dizisi, modelin çıkışında da bunları kullanmasına neden olabilir.
Modele izin verilen kaçış karakterleri hakkında talimat verin. Şuna benzer bir sistem talimatı ekleyin:

            In quoted strings, the only allowed escape sequences are \\, \n, and \". Instead of \u escapes, use UTF-8.
          
Yapılandırılmış çıkışta tekrarlanan metin	Model çıkışında alanların sırası, tanımlanan yapılandırılmış şemadan farklı olduğunda metin tekrarı oluşabilir.	
İsteminizde alanların sırasını belirtmeyin.
Tüm çıkış alanlarını zorunlu hale getirin.
Tekrarlanan araç çağrıları	Bu durum, modelin önceki düşüncelerin bağlamını kaybetmesi ve/veya kullanılamayan bir uç noktayı çağırmaya zorlanması durumunda ortaya çıkabilir.	Modele, düşünce sürecinde durumu koruması talimatını verin. Bunu sistem talimatlarınızın sonuna ekleyin:

        When thinking silently: ALWAYS start the thought with a brief
        (one sentence) recap of the current progress on the task. In
        particular, consider whether the task is already done.
      
Yapılandırılmış çıkışın parçası olmayan tekrarlayan metin	Bu durum, modelin çözemediği bir istekte takılıp kalması halinde ortaya çıkabilir.	
Düşünme özelliği etkinse talimatlarda bir sorunu nasıl düşüneceğinizle ilgili açıkça emir vermeyin. Yalnızca son çıktıyı isteyin.
Daha yüksek bir sıcaklık (ör. >= 0,8) deneyin.
"Kısa ve öz ol", "Kendini tekrar etme" veya "Cevabı bir kez ver" gibi talimatlar ekleyin.
Model çıktısını iyileştirme
Daha kaliteli model çıkışları için daha yapılandırılmış istemler yazmayı deneyin. İstem mühendisliği kılavuzu sayfasında, başlamanıza yardımcı olacak bazı temel kavramlar, stratejiler ve en iyi uygulamalar tanıtılmaktadır.

Jeton sınırlarını anlama
Jetonların nasıl sayıldığını ve sınırlarını daha iyi anlamak için Jeton kılavuzumuzu inceleyin.

Bilinen sorunlar
API yalnızca belirli dilleri destekler. Desteklenmeyen dillerde istem göndermek beklenmedik veya hatta engellenmiş yanıtlar üretebilir. Güncellemeler için kullanılabilir dilleri inceleyin.
Hata bildir
Sorularınız varsa Google Yapay Zeka geliştirici forumunda tartışmaya katılın.Jetonları anlama ve sayma

Python JavaScript Go



Gemini ve diğer üretken yapay zeka modelleri, giriş ve çıkışı jeton adı verilen bir ayrıntı düzeyinde işler.

Jetonlar hakkında
Jetonlar, z gibi tek karakterler veya cat gibi tam kelimeler olabilir. Uzun kelimeler birkaç jetona ayrılır. Model tarafından kullanılan tüm jetonlar kümesine kelime dağarcığı, metni jetonlara bölme işlemine ise jetonlaştırma adı verilir.

Gemini modellerinde bir jeton yaklaşık 4 karaktere eşittir. 100 jeton yaklaşık 60-80 İngilizce kelimeye eşittir.

Faturalandırma etkinleştirildiğinde Gemini API'ye yapılan bir çağrının maliyeti kısmen giriş ve çıkış jetonlarının sayısına göre belirlenir. Bu nedenle, jetonları nasıl sayacağınızı bilmek faydalı olabilir.

Colab'de jeton saymayı deneyin
Colab kullanarak jeton saymayı deneyebilirsiniz.

Colab not defterini deneyin
Not defterini GitHub'da görüntüleyin
Bağlam pencereleri
Gemini API aracılığıyla kullanılabilen modellerin bağlam pencereleri, jetonlarla ölçülür. Bağlam penceresi, ne kadar giriş sağlayabileceğinizi ve modelin ne kadar çıkış oluşturabileceğini tanımlar. getModels uç noktasını çağırarak veya modeller dokümanlarına bakarak bağlam penceresinin boyutunu belirleyebilirsiniz.

Aşağıdaki örnekte, gemini-1.5-flash modelinin yaklaşık 1.000.000 giriş jetonu ve yaklaşık 8.000 çıkış jetonu sınırı olduğunu görebilirsiniz. Bu da bağlam penceresinin 1.000.000 jeton olduğu anlamına gelir.


from google import genai

client = genai.Client()
model_info = client.models.get(model="gemini-2.0-flash")
print(f"{model_info.input_token_limit=}")
print(f"{model_info.output_token_limit=}")
# ( e.g., input_token_limit=30720, output_token_limit=2048 )

Parça sayma
Metin, resim dosyaları ve metin dışı diğer formatlar da dahil olmak üzere Gemini API'ye yapılan tüm girişler ve API'den alınan tüm çıkışlar jetonlaştırılır.

Jetonları aşağıdaki şekillerde sayabilirsiniz:

Metin jetonlarını sayma

from google import genai

client = genai.Client()
prompt = "The quick brown fox jumps over the lazy dog."

# Count tokens using the new client method.
total_tokens = client.models.count_tokens(
    model="gemini-2.0-flash", contents=prompt
)
print("total_tokens: ", total_tokens)
# ( e.g., total_tokens: 10 )

response = client.models.generate_content(
    model="gemini-2.0-flash", contents=prompt
)

# The usage_metadata provides detailed token counts.
print(response.usage_metadata)
# ( e.g., prompt_token_count: 11, candidates_token_count: 73, total_token_count: 84 )

Çok adımlı (sohbet) jetonlarını sayma

from google import genai
from google.genai import types

client = genai.Client()

chat = client.chats.create(
    model="gemini-2.0-flash",
    history=[
        types.Content(
            role="user", parts=[types.Part(text="Hi my name is Bob")]
        ),
        types.Content(role="model", parts=[types.Part(text="Hi Bob!")]),
    ],
)
# Count tokens for the chat history.
print(
    client.models.count_tokens(
        model="gemini-2.0-flash", contents=chat.get_history()
    )
)
# ( e.g., total_tokens: 10 )

response = chat.send_message(
    message="In one sentence, explain how a computer works to a young child."
)
print(response.usage_metadata)
# ( e.g., prompt_token_count: 25, candidates_token_count: 21, total_token_count: 46 )

# You can count tokens for the combined history and a new message.
extra = types.UserContent(
    parts=[
        types.Part(
            text="What is the meaning of life?",
        )
    ]
)
history = chat.get_history()
history.append(extra)
print(client.models.count_tokens(model="gemini-2.0-flash", contents=history))
# ( e.g., total_tokens: 56 )

Çok formatlı parçaları sayma
Gemini API'ye yapılan tüm girişler (metin, resim dosyaları ve diğer metin dışı biçimler dahil) jetonlaştırılır. Gemini API tarafından işleme sırasında çok formatlı girişin jetonlaştırılmasıyla ilgili aşağıdaki üst düzey önemli noktaları göz önünde bulundurun:

Gemini 2.0 ile her iki boyutu da <=384 piksel olan resim girişleri 258 jeton olarak sayılır. Bir veya iki boyutta daha büyük olan resimler, gerektiğinde 768x768 piksellik parçalar halinde kırpılır ve ölçeklendirilir. Bu parçaların her biri 258 jeton olarak sayılır. Gemini 2.0'dan önce, görsellerde sabit 258 jeton kullanılıyordu.

Video ve ses dosyaları, aşağıdaki sabit oranlarda jetonlara dönüştürülür: Video: Saniyede 263 jeton, ses: saniyede 32 jeton.

Resim dosyaları
Not: Dosya API'si kullanılarak yüklenen bir dosyayı kullanırsanız veya dosyayı satır içi veri olarak sağlarsanız aynı jeton sayısını elde edersiniz.
File API'den yüklenen bir görüntünün kullanıldığı örnek:


from google import genai

client = genai.Client()
prompt = "Tell me about this image"
your_image_file = client.files.upload(file=media / "organ.jpg")

print(
    client.models.count_tokens(
        model="gemini-2.0-flash", contents=[prompt, your_image_file]
    )
)
# ( e.g., total_tokens: 263 )

response = client.models.generate_content(
    model="gemini-2.0-flash", contents=[prompt, your_image_file]
)
print(response.usage_metadata)
# ( e.g., prompt_token_count: 264, candidates_token_count: 80, total_token_count: 345 )

Resmi satır içi veri olarak sağlayan örnek:


from google import genai
import PIL.Image

client = genai.Client()
prompt = "Tell me about this image"
your_image_file = PIL.Image.open(media / "organ.jpg")

# Count tokens for combined text and inline image.
print(
    client.models.count_tokens(
        model="gemini-2.0-flash", contents=[prompt, your_image_file]
    )
)
# ( e.g., total_tokens: 263 )

response = client.models.generate_content(
    model="gemini-2.0-flash", contents=[prompt, your_image_file]
)
print(response.usage_metadata)
# ( e.g., prompt_token_count: 264, candidates_token_count: 80, total_token_count: 345 )

Video veya ses dosyaları
Ses ve video, aşağıdaki sabit oranlarda jetonlara dönüştürülür:

Video: Saniyede 263 jeton
Ses: Saniyede 32 jeton
Not: Dosya API'si kullanılarak yüklenen bir dosyayı kullanırsanız veya dosyayı satır içi veri olarak sağlarsanız aynı jeton sayısını elde edersiniz.

from google import genai
import time

client = genai.Client()
prompt = "Tell me about this video"
your_file = client.files.upload(file=media / "Big_Buck_Bunny.mp4")

# Poll until the video file is completely processed (state becomes ACTIVE).
while not your_file.state or your_file.state.name != "ACTIVE":
    print("Processing video...")
    print("File state:", your_file.state)
    time.sleep(5)
    your_file = client.files.get(name=your_file.name)

print(
    client.models.count_tokens(
        model="gemini-2.0-flash", contents=[prompt, your_file]
    )
)
# ( e.g., total_tokens: 300 )

response = client.models.generate_content(
    model="gemini-2.0-flash", contents=[prompt, your_file]
)
print(response.usage_metadata)
# ( e.g., prompt_token_count: 301, candidates_token_count: 60, total_token_count: 361 )

Sistem talimatları ve araçları
Sistem talimatları ve araçları da girişin toplam jeton sayısına dahil edilir.

Sistem talimatları kullanırsanız total_tokens sayısı, system_instruction eklenmesini yansıtacak şekilde artar.

İşlev çağrısı kullanıyorsanız total_tokens sayısı, tools eklenmesini yansıtacak şekilde artar.Hızlı tasarım stratejileri

İstem tasarımı, dil modelinden doğru ve yüksek kaliteli yanıtlar alınmasını sağlayan istemler veya doğal dil istekleri oluşturma sürecidir.

Bu sayfada, Gemini yapay zeka modellerinden en iyi şekilde yararlanmak için istem tasarlamaya başlamanıza yardımcı olacak temel kavramlar, stratejiler ve en iyi uygulamalar tanıtılmaktadır.

Konuya özel istem kılavuzları
Daha spesifik istem stratejileri mi arıyorsunuz? Aşağıdaki konularda diğer istem kılavuzlarımıza göz atın:

Medya dosyalarıyla istem oluşturma
Imagen ve Gemini Native Image Generation ile görüntü üretme için istem oluşturma
Video üretme için istem girme
Bu kılavuzda paylaşılan birçok kavramı etkileşimli olarak sergilemek için tasarlanan istem galerisinde diğer örnek istemleri bulabilirsiniz.

Net ve spesifik talimatlar
Model davranışını özelleştirmenin etkili ve verimli bir yolu, modele net ve spesifik talimatlar vermektir. Talimatlar soru, adım adım görevler şeklinde veya kullanıcının deneyimini ve düşünce yapısını haritalandırmak kadar karmaşık olabilir.

Giriş
Giriş, istemde modelin yanıt vermesini istediğiniz zorunlu metindir. Girişler; modelin yanıtladığı bir soru (soru girişi), modelin gerçekleştirdiği bir görev (görev girişi), modelin üzerinde işlem yaptığı bir varlık (varlık girişi) veya modelin tamamladığı ya da devam ettirdiği kısmi giriş (tamamlama girişi) olabilir.

Giriş türü	İstem	Oluşturulan çıktı
Soru	


What's a good name for a flower shop that specializes in selling bouquets of
dried flowers? Create a list of 5 options with just the names.


Here are 10 names for a flower shop specializing in dried flowers:

1. Everlasting Blooms
2. Dried & Delightful
3. The Petal Preserve
4. Whispers of Wildflowers
5. Forever Blooms
Görev	

Give me a simple list of just the things that I must bring on a camping trip. The list should have 5 items.

1. **Tent:** Your shelter from the elements.
2. **Sleeping Bag:** Stay warm and comfortable.
3. **Sleeping Pad:** Insulation and cushioning for a good night's sleep.
4. **Headlamp or Flashlight:** Light for nighttime activities.
5. **First Aid Kit:** Be prepared for minor injuries.
Varlık	


Classify the following items as [large, small]:
Elephant
Mouse
Snail


Here's the classification:

* **Elephant:** Large
* **Mouse:** Small
* **Snail:** Small
Kısmi giriş tamamlama
Üretken dil modelleri, gelişmiş bir otomatik tamamlama aracı gibi çalışır. Kısmi içerik sağladığınızda model, içeriğin geri kalanını veya içeriğin devamı olduğunu düşündüğü kısmı yanıt olarak verebilir. Bunu yaparken örnek veya bağlam eklerseniz model bu örnekleri ya da bağlamı dikkate alabilir.

Aşağıdaki örnekte, talimat ve öğe girişi içeren bir istem sağlanmaktadır:

İstem:

For the given order, return a JSON object that has the fields cheeseburger, hamburger, fries, or
drink, with the value being the quantity.

Order: A burger and a drink.
Yanıt:

{
"cheeseburger": 0,
"hamburger": 1,
"fries": 0,
"drink": 1
}
(gemini-2.5-flash)
Model, isteneni yapsa da talimatları doğal dilde yazmak bazen zor olabilir ve modelin yorumuna çok şey bırakır. Örneğin, bir restoranın menüsünde birçok öğe olabilir. JSON yanıtının boyutunu küçültmek için sipariş edilmeyen öğeleri atlamak isteyebilirsiniz. Bu durumda, bir örnek ve yanıt öneki verebilir ve modelin bunu tamamlamasına izin verebilirsiniz:

İstem:

Valid fields are cheeseburger, hamburger, fries, and drink.
Order: Give me a cheeseburger and fries
Output:
```
{
"cheeseburger": 1,
"fries": 1
}
```
Order: I want two burgers, a drink, and fries.
Output:
Yanıt:

```
{
"hamburger": 2,
"drink": 1,
"fries": 1
}
```
(gemini-2.5-flash)
"Cheeseburger"ın siparişin bir parçası olmadığı için çıkıştan nasıl hariç tutulduğuna dikkat edin.

Sınırlamalar
İstemi okuma veya yanıt oluşturma ile ilgili kısıtlamaları belirtin. Modele ne yapıp ne yapmaması gerektiğini söyleyebilirsiniz. Örneğin, istemde özetin ne kadar uzun olmasını istediğinize dair bir kısıtlama belirtebilirsiniz:

İstem:


Summarize this text in one sentence:
Text: A quantum computer exploits quantum mechanical phenomena to perform calculations exponentially
faster than any modern traditional computer. At very tiny scales, physical matter acts as both
particles and as waves, and quantum computing uses specialized hardware to leverage this behavior.
The operating principles of quantum devices is beyond the scope of classical physics. When deployed
at scale, quantum computers could be used in a wide variety of applications such as: in
cybersecurity to break existing encryption methods while helping researchers create new ones, in
meteorology to develop better weather forecasting etc. However, the current state of the art quantum
computers are still largely experimental and impractical.
Yanıt:


Exploiting quantum mechanical phenomena, quantum computers can perform calculations exponentially faster than traditional computers for potential applications like cybersecurity and meteorology, although they are currently largely experimental and impractical.
(gemini-2.5-flash)
Yanıt biçimi
Yanıtın biçimini belirten talimatlar verebilirsiniz. Örneğin, yanıtın tablo, madde işaretli liste, kısa tanıtım, anahtar kelimeler, cümle veya paragraf olarak biçimlendirilmesini isteyebilirsiniz. Aşağıdaki sistem talimatı, modele yanıtında daha sohbet tarzında olmasını söylüyor:

Sistem talimatı

All questions should be answered comprehensively with details, unless the user requests a concise response specifically.
İstem

What is a smart way to make a business that sells DVD's in 2025?
Yanıt:

Starting a business selling DVDs in 2025 presents significant challenges due to the overwhelming dominance of digital streaming and on-demand services; a "smart" approach would therefore require a highly specialized niche, a strong value proposition beyond just the disc, and likely a focus on community or collector markets rather than mainstream consumption.

Here's a breakdown of what a smart DVD business in 2025 would likely entail:

1. Extreme Niche Specialization: You cannot compete with streaming libraries. Your business must focus on what digital doesn't offer easily or at all. This could include:

* Out-of-Print & Rare Titles: Sourcing films or TV shows that have never been released digitally or are currently unavailable on major streaming platforms.
....
(gemini-2.5-flash)
Tamamlama stratejisiyle yanıtları biçimlendirme
Tamamlama stratejisi, yanıtın biçimlendirilmesine de yardımcı olabilir. Aşağıdaki örnekte, modelden bir makale taslağı oluşturması isteniyor:

İstem:

Create an outline for an essay about hummingbirds.
Yanıt:

Here is a possible outline for an essay about hummingbirds:

I. Introduction
A. Hook: Start with a captivating fact or description about hummingbirds (e.g., their speed, iridescent colors, or tiny size).
B. Background: Briefly introduce hummingbirds – where they are found (Americas), their reputation as unique birds.
C. Thesis Statement: State the main point of the essay, which could be about the remarkable adaptations, behaviors, and ecological importance of hummingbirds.

II. Appearance and Identification
.....
(gemini-2.5-flash)
İstemde, taslak için biçim belirtilmedi ve model sizin için bir biçim seçti. Modelin belirli bir biçimde ana hat döndürmesini sağlamak için ana hattın başlangıcını temsil eden metin ekleyebilir ve başlattığınız düzene göre modeli tamamlamasına izin verebilirsiniz.

İstem:

Create an outline for an essay about hummingbirds.
I. Introduction
*
Yanıt:

Okay, here is an outline for an essay about hummingbirds, starting from the introduction you provided:

I. Introduction
* Hook: Start with a captivating fact or description about hummingbirds (e.g., their speed, iridescent colors, or tiny size).
* Background: Briefly introduce hummingbirds – where they are found (Americas), their reputation as unique birds, and their general characteristics.
* Thesis Statement: State the main point of the essay, focusing on the remarkable adaptations, behaviors, and ecological significance that make hummingbirds extraordinary.
.....
(gemini-2.5-flash)
Sıfır görevli ve çok görevli istemler
İstemde, modele doğru yanıtın nasıl göründüğünü gösteren örnekler ekleyebilirsiniz. Model, örneklerdeki kalıpları ve ilişkileri belirlemeye çalışır ve yanıt oluştururken bunları uygular. Birkaç örnek içeren istemlere çok görevli istem, örnek içermeyen istemlere ise sıfır görevli istem adı verilir. Çok görevli istemler genellikle model yanıtlarının biçimlendirmesini, ifade tarzını, kapsamını veya genel kalıbını düzenlemek için kullanılır. Modelin odak noktasını daraltmasına ve daha doğru sonuçlar üretmesine yardımcı olmak için spesifik ve çeşitli örnekler kullanın.

İstemlerinize her zaman birkaç görevli örnek eklemenizi öneririz. Birkaç görev örneği içermeyen istemlerin etkili olma olasılığı daha düşüktür. Hatta örnekleriniz, söz konusu görevi gösterme konusunda yeterince netse isteminizdeki talimatları kaldırabilirsiniz.

Aşağıdaki sıfır görevli istemde modelden en iyi açıklamayı seçmesi isteniyor.

İstem:

Please choose the best explanation to the question:

Question: How is snow formed?
Explanation1: Snow is formed when water vapor in the air freezes into ice
crystals in the atmosphere, which can combine and grow into snowflakes as they
fall through the atmosphere and accumulate on the ground.
Explanation2: Water vapor freezes into ice crystals forming snow.
Answer:
Yanıt:

Explanation1 is the better explanation because it provides more detail on the
process, including how ice crystals combine and grow into snowflakes as they
fall through the atmosphere.
(gemini-2.5-flash)
Kullanım alanınızda modelin kısa yanıtlar üretmesi gerekiyorsa isteme kısa yanıtları tercih eden örnekler ekleyebilirsiniz.

Aşağıdaki istemde, daha kısa açıklamalara öncelik verildiğini gösteren iki örnek verilmiştir. Yanıtta, örneklerin modeli daha önce yaptığı gibi daha uzun açıklama (Explanation1) yerine daha kısa açıklamayı (Explanation2) seçmeye yönlendirdiği görülüyor.

İstem:

Below are some examples showing a question, explanation, and answer format:

Question: Why is the sky blue?
Explanation1: The sky appears blue because of Rayleigh scattering, which causes
shorter blue wavelengths of light to be scattered more easily than longer red
wavelengths, making the sky look blue.
Explanation2: Due to Rayleigh scattering effect.
Answer: Explanation2

Question: What is the cause of earthquakes?
Explanation1: Sudden release of energy in the Earth's crust.
Explanation2: Earthquakes happen when tectonic plates suddenly slip or break
apart, causing a release of energy that creates seismic waves that can shake the
ground and cause damage.
Answer: Explanation1

Now, Answer the following question given the example formats above:

Question: How is snow formed?
Explanation1: Snow is formed when water vapor in the air freezes into ice
crystals in the atmosphere, which can combine and grow into snowflakes as they
fall through the atmosphere and accumulate on the ground.
Explanation2: Water vapor freezes into ice crystals forming snow.
Answer:
Yanıt:

Answer: Explanation2
(gemini-2.5-flash)
İdeal örnek sayısı
Gemini gibi modeller, genellikle birkaç örnek kullanarak kalıpları algılayabilir. Ancak en iyi sonuçları elde etmek için istemde sağlanan örnek sayısıyla denemeler yapmanız gerekebilir. Aynı zamanda, çok fazla örnek eklerseniz model, yanıtı örneklere göre aşırı öğrenmeye başlayabilir.

Kalıplar ve anti kalıplar
Modele izlemesi gereken bir kalıbı göstermek için örnekler kullanmak, kaçınması gereken bir anti kalıbı göstermek için örnekler kullanmaktan daha etkilidir.

⛔ Olumsuz kalıp:

Örnek

Don't end haikus with a question:
Haiku are fun
A short and simple poem
Don't you enjoy them?

✅ Olumlu kalıp:

Örnek

Always end haikus with an assertion:
Haiku are fun
A short and simple poem
A joy to write

Tutarlı format
İstenmeyen biçimlerde yanıtlar almamak için birden çok örnekteki yapının ve biçimlendirmenin aynı olduğundan emin olun. İstemlere az görevli örnekler eklemenin temel amaçlarından biri, modele yanıt biçimini göstermektir. Bu nedenle, özellikle XML etiketlerine, boşluklara, yeni satırlara ve örnek ayırıcılara dikkat ederek tüm örneklerde tutarlı bir biçim sağlamak çok önemlidir.

Bağlam bilgisi ekleme
Modelin gerekli tüm bilgilere sahip olduğunu varsaymak yerine, bir isteme talimatlar ve bilgiler ekleyerek modelin bir sorunu çözmesini sağlayabilirsiniz. Bu bağlamsal bilgiler, modelin istediğiniz işle ilgili kısıtlamaları ve ayrıntıları anlamasına yardımcı olur.

Aşağıdaki örnekte, modelden bir yönlendiriciyle ilgili sorun giderme talimatları vermesi isteniyor:

İstem:

What should I do to fix my disconnected wifi? The light on my Google
Wifi router is yellow and blinking slowly.
Yanıt:

A yellow blinking light on your Google Wifi router usually indicates a problem
with the internet connection. Here are some steps to troubleshoot and fix the
issue:
1. Restart your router and modem:
- Unplug your modem from the power outlet and wait for 30 seconds.
- Plug your modem back in and wait for it to fully boot up.
- Unplug your Google Wifi router and wait for 30 seconds.
- Plug your Google Wifi router back in and wait for it to fully boot up.
.....
(gemini-2.5-flash)
Yanıtta, yönlendiriciye veya LED gösterge ışıklarının durumuna özgü olmayan genel sorun giderme bilgileri yer alıyor.

Yanıtı belirli bir yönlendirici için özelleştirmek istiyorsanız isteme, yanıt verirken başvurması için yönlendiricinin sorun giderme kılavuzunu bağlam olarak ekleyebilirsiniz.

İstem:

Answer the question using the text below. Respond with only the text provided.
Question: What should I do to fix my disconnected wifi? The light on my Google Wifi router is yellow and blinking slowly.

Text:
Color: Slowly pulsing yellow
What it means: There is a network error.
What to do:
Check that the Ethernet cable is connected to both your router and your modem and both devices are turned on. You might need to unplug and plug in each device again.

Color: Fast blinking yellow
What it means: You are holding down the reset button and are factory resetting this device.
What to do:
If you keep holding down the reset button, after about 12 seconds, the light will turn solid yellow. Once it is solid yellow, let go of the factory reset button.

Color: Solid yellow
What it means: Router is factory resetting.
What to do:
This can take up to 10 minutes. When it's done, the device will reset itself and start pulsing white, letting you know it's ready for setup.

Color: Solid red
What it means: Something is wrong.
What to do:
Critical failure. Factory reset the router. If the light stays red, contact Wifi customer support.
Yanıt:

Check that the Ethernet cable is connected to both your router and your modem and both devices are turned on. You might need to unplug and plug in each device again.
(gemini-2.5-flash)
Önek ekleme
Ön ek, istem içeriğine eklediğiniz bir kelime veya kelime öbeğidir. Ön eki nereye yerleştirdiğinize bağlı olarak çeşitli amaçlara hizmet edebilir:

Giriş öneki: Giriş sinyallerine önek eklemek, girişin anlamsal olarak anlamlı kısımlarını modele ekler. Örneğin, "İngilizce:" ve "Fransızca:" önekleri iki farklı dili belirtir.
Çıkış öneki: Çıkış model tarafından oluşturulsa da isteme çıkış için bir önek ekleyebilirsiniz. Çıkış öneki, modele yanıt olarak ne beklendiği hakkında bilgi verir. Örneğin, "JSON:" çıkış öneki, çıkışın JSON biçiminde olması gerektiğini modele bildirir.
Önek örneği: Az görevli istemlerde örneklere önek eklemek, modelin çıkışı oluştururken kullanabileceği etiketler sağlar. Bu da çıkış içeriğinin ayrıştırılmasını kolaylaştırır.
Aşağıdaki örnekte, "Metin:" giriş öneki, "Yanıt:" ise çıkış önekidir.

İstem:

Classify the text as one of the following categories.
- large
- small
Text: Rhino
The answer is: large
Text: Mouse
The answer is: small
Text: Snail
The answer is: small
Text: Elephant
The answer is:
Yanıt:

The answer is: large
(gemini-2.5-flash)
İstemleri bileşenlere ayırma
Karmaşık istemler gerektiren kullanım alanlarında, öğeleri daha basit bileşenlere ayırarak modelin bu karmaşıklığı yönetmesine yardımcı olabilirsiniz.

Talimatları bölme: Tek bir istemde çok sayıda talimat vermek yerine her talimat için ayrı bir istem oluşturun. Kullanıcının girişine göre hangi istemin işleneceğini seçebilirsiniz.

Zincirleme istemler: Sıralı birden fazla adım içeren karmaşık görevler için her adımı istem olarak girin ve istemleri bir sırayla zincirleyin. Bu sıralı istem zincirinde, dizideki bir istemin çıkışı bir sonraki istemin girişi olur. Dizideki son istemin çıkışı, nihai çıkıştır.

Yanıtları toplama: Toplama, verilerin farklı bölümlerinde farklı paralel görevler gerçekleştirmek ve sonuçları toplayarak nihai çıktıyı oluşturmak istediğinizde kullanılır. Örneğin, modele verilerin ilk bölümünde bir işlem, verilerin geri kalanında başka bir işlem yapmasını ve sonuçları toplaması talimatını verebilirsiniz.

Model parametreleriyle deneme yapma
Bir modele gönderdiğiniz her çağrı, modelin nasıl yanıt üreteceğini kontrol eden parametre değerleri içerir. Model, farklı parametre değerleri için farklı sonuçlar üretebilir. Görev için en iyi değerleri elde etmek üzere farklı parametre değerleriyle denemeler yapın. Farklı modeller için kullanılabilen parametreler farklı olabilir. En yaygın parametreler şunlardır:

Maksimum çıkış jetonu: Yanıtta oluşturulabilecek maksimum jeton sayısını belirtir. Bir jeton, yaklaşık dört karakterden oluşur. 100 jeton yaklaşık 60-80 kelimeye karşılık gelir.

Sıcaklık: Sıcaklık, jeton seçimindeki rastgelelik derecesini kontrol eder. Sıcaklık, yanıt oluşturma sırasında örnekleme için kullanılır. Bu işlem, topP ve topK uygulandığında gerçekleşir. Düşük sıcaklıklar, daha belirleyici veya daha az açık uçlu yanıt gerektiren istemler için tercih edilir. Yüksek sıcaklıklar ise daha çeşitli veya yaratıcı sonuçlar sunabilir. Sıcaklık 0 olduğunda her zaman en yüksek olasılığa sahip yanıt seçilir.

topK: topK parametresi, modelin çıkış için jeton seçme şeklini değiştirir. 1 topK, seçilen jetonun modelin kelime dağarcığındaki (açgözlü kod çözme olarak da adlandırılır) tüm jetonlar arasında en olası jeton olduğu anlamına gelir. 3 topK ise bir sonraki jetonun sıcaklık kullanılarak en olası 3 jeton arasından seçildiği anlamına gelir. Her jeton seçimi adımında, en yüksek olasılıklara sahip topK jeton örneklenir. Daha sonra jetonlar topP'ye göre daha da filtrelenir ve son jeton, sıcaklık örneklemesi kullanılarak seçilir.

topP: topP parametresi, modelin çıkış için jeton seçme şeklini değiştirir. Olasılıklarının toplamı topP değerine eşit olana kadar en olasıdan en az olasıya doğru parçalar seçilir. Örneğin, A, B ve C jetonlarının olasılığı 0,3, 0,2 ve 0,1 ise ve topP değeri 0,5 ise model, sıcaklığı kullanarak sonraki jeton olarak A veya B'yi seçer ve C'yi aday olarak hariç tutar. Varsayılan topP değeri 0,95'tir.

stop_sequences: Modeli içerik oluşturmayı durdurmaya yönlendirmek için durdurma sırası ayarlayın. Durdurma dizisi herhangi bir karakter dizisi olabilir. Oluşturulan içerikte görünebilecek karakter dizilerini kullanmaktan kaçının.

İstem tekrarlama stratejileri
İstemi tasarlarken istediğiniz yanıtı tutarlı bir şekilde alabilmek için bazen birkaç yineleme yapmanız gerekebilir. Bu bölümde, istemlerinizi yineleme sırasında deneyebileceğiniz bazı yöntemler hakkında bilgi verilmektedir:

Farklı ifadeler kullanın: İstemlerinizde farklı kelimeler veya ifadeler kullanmak, aynı anlama gelseler bile modelden genellikle farklı yanıtlar almanızı sağlar. İsteminizden beklediğiniz sonuçları alamıyorsanız isteminizi yeniden ifade etmeyi deneyin.


Version 1:
How do I bake a pie?

Version 2:
Suggest a recipe for a pie.

Version 3:
What's a good pie recipe?

Benzer bir göreve geçin: Modelin bir görevle ilgili talimatlarınızı uygulamasını sağlayamıyorsanız aynı sonucu elde eden benzer bir görevle ilgili talimatlar vermeyi deneyin.

Bu istemde, modelden önceden tanımlanmış kategorileri kullanarak bir kitabı sınıflandırması isteniyor:

İstem:

Which category does The Odyssey belong to:
thriller
sci-fi
mythology
biography
Yanıt:

The Odyssey belongs to the category of **mythology**.

Here's why:

* **Mythology:** The Odyssey tells the story of Odysseus, a hero from Greek mythology, and his
journey home after the Trojan War. It features gods, monsters, and supernatural events common to
Greek mythology.
.....
(gemini-2.5-flash)
Yanıt doğru ancak model, seçeneklerin sınırları içinde kalmadı. Ayrıca, modelin tam cümleyle yanıt vermek yerine yalnızca seçeneklerden birini kullanarak yanıt vermesini istiyorsunuz. Bu durumda, talimatları çoktan seçmeli soru olarak yeniden ifade edebilir ve modelden bir seçenek belirlemesini isteyebilirsiniz.

İstem:

Multiple choice problem: Which of the following options describes the book The Odyssey?
Options:



thriller

sci-fi

mythology

biography
Yanıt:

The correct answer is mythology.
(gemini-2.5-flash)
İstem içeriğinin sırasını değiştirme: İstemdeki içeriğin sırası bazen yanıtı etkileyebilir. İçerik sırasını değiştirmeyi deneyin ve bunun yanıtı nasıl etkilediğini görün.


Version 1:
[examples]
[context]
[input]

Version 2:
[input]
[examples]
[context]

Version 3:
[examples]
[input]
[context]
Yedek yanıtlar
Yedek yanıt, istem veya yanıt bir güvenlik filtresini tetiklediğinde model tarafından döndürülen yanıttır. Yedek yanıta örnek olarak "Ben sadece bir dil modeli olduğum için bu konuda yardımcı olamıyorum." verilebilir.

Model, yedek yanıtla karşılık verirse sıcaklığı artırmayı deneyin.

Yapılmaması gerekenler
Doğru bilgiler üretmek için modellere güvenmekten kaçının.
Matematik ve mantık problemlerinde dikkatli kullanın.
Perde arkasındaki üretken modeller
Bu bölümde, Üretken modellerin yanıtlarında rastgelelik var mı yoksa yanıtlar deterministik mi? sorusunun yanıtlanması amaçlanmaktadır.

Kısa yanıt: Her ikisi de evet. Üretken bir modele istem girdiğinizde metin yanıtı iki aşamada oluşturulur. İlk aşamada, üretken model giriş istemini işler ve bir sonraki kelime olma olasılığı yüksek olan olası jetonlar (kelimeler) üzerinde bir olasılık dağılımı oluşturur. Örneğin, "Köpek ... üzerinden atladı" giriş metniyle istem gönderirseniz üretken model, olası bir sonraki kelime dizisi oluşturur:


[("fence", 0.77), ("ledge", 0.12), ("blanket", 0.03), ...]
Bu süreç deterministiktir. Üretken model, aynı istem metni her girildiğinde aynı dağıtımı üretir.

İkinci aşamada, üretken model bu dağıtımları çeşitli kod çözme stratejilerinden birini kullanarak gerçek metin yanıtlarına dönüştürür. Basit bir kod çözme stratejisi, her zaman adımında en olası jetonu seçebilir. Bu işlem her zaman deterministik olacaktır. Ancak bunun yerine, modelin döndürdüğü dağıtımda rastgele örnekleme yaparak yanıt oluşturmayı da seçebilirsiniz. Bu süreç stokastik (rastgele) olacaktır. Sıcaklığı ayarlayarak bu kod çözme işleminde izin verilen rastgelelik derecesini kontrol edin. Sıcaklık 0 olduğunda yalnızca en olası jetonlar seçilir ve rastgelelik yoktur. Buna karşılık, yüksek sıcaklık, model tarafından seçilen jetonlara yüksek derecede rastgelelik katarak daha beklenmedik ve şaşırtıcı model yanıtlarına yol açar.

Sonraki adımlar
İstem tasarımını daha iyi anladığınıza göre Google AI Studio'yu kullanarak kendi istemlerinizi yazmayı deneyin.
Çok formatlı istemler hakkında bilgi edinmek için Medya dosyalarıyla istem oluşturma başlıklı makaleyi inceleyin.
Resim istemi hakkında bilgi edinmek için Imagen istem rehberine bakın.
Video istemi hakkında bilgi edinmek için Veo istem kılavuzuna bakın.

const Discord = require("discord.js");
const ytdl = require("ytdl-core");
const yts = require("yt-search");
const {prefix, token} = require("./config.json");

const bot = new Discord.Client();
const queue = new Map();

bot.once("ready", () => {
  console.log("Ready!");
});
bot.once("reconnecting", () => {
  console.log("Reconnecting!");
});
bot.once("disconnect", () => {
  console.log("Disconnect!");
});

bot.on("message", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const serverQueue = queue.get(message.guild.id);

  if (message.content.startsWith(`${prefix}play`)) {
    execute(message, serverQueue);
  } else if (message.content.startsWith(`${prefix}search`)) {
    searchVideo(message, serverQueue);
  } else if (message.content.startsWith(`${prefix}skip`)) {
    skip(message, serverQueue);
  } else if (message.content.startsWith(`${prefix}stop`)) {
    stop(message, serverQueue);
  } else if (message.content.startsWith(`${prefix}queue`)) {
    playlist(message, serverQueue);
  } else if (message.content.startsWith(`${prefix}commands`)) {
    showCommands(message);
  } else {
    message.channel.send("Você precisa escrever um comando válido!");
  }
});

function showCommands(message) {
  const commands = [
    { name: "!play [musica/artista]", value: "Toca uma música ou artista." },
    {
      name: "!search [musica/astista]",
      value: "Procura uma música ou artista.",
    },
    {
      name: "!skip [posição]",
      value: "Pule uma música ou vá para uma musica específica da playlist.",
    },
    { name: "!stop", value: "Pare a reprodução de música." },
    { name: "!queue", value: "Exibe a playlist." },
    { name: "!commands", value: "Exibe a lista de comandos." },
  ];

  let msg = new Discord.MessageEmbed()
    .setColor("#00FFFF")
    .setTitle("Comandos!")
    .setAuthor("Astronaut", "https://i.imgur.com/Dv0JT72.png")
    .addFields(commands)
    .setTimestamp()
    .setFooter("Astronaut");
  message.channel.send({ embed: msg });
}
async function execute(message, serverQueue) {
  const args = message.content.split(" ");

  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) {
    return message.channel.send(
      "Você precisa estar em um canal de voz para tocar uma música!"
    );
  }
  const permissions = voiceChannel.permissionsFor(message.client.user);
  if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
    return message.channel.send(
      "Eu preciso de permissão para entrar e falar no seu canal de voz!"
    );
  }

  if (args.length < 2)
    return message.channel.send(
      "Você precisa informar qual música eu devo tocar!"
    );
  let song;
  if (ytdl.validateURL(args[1])) {
    const songInfo = await ytdl.getInfo(args[1]);
    song = {
      title: songInfo.title,
      url: songInfo.video_url,
    };
  } else {
    const { videos } = await yts(args.slice(1).join(" "));
    if (!videos.length)
      return message.channel.send("Nenhuma música foi encontrada!");
    song = {
      title: videos[0].title,
      url: videos[0].url,
      thumbnail: videos[0].thumbnail,
      author: videos[0].author.name,
    };
  }

  if (!serverQueue) {
    const queueContruct = {
      textChannel: message.channel,
      voiceChannel: voiceChannel,
      connection: null,
      songs: [],
      volume: 5,
      playing: true,
    };

    queue.set(message.guild.id, queueContruct);

    queueContruct.songs.push(song);

    try {
      var connection = await voiceChannel.join();
      queueContruct.connection = connection;
      play(message.guild, queueContruct.songs[0]);
    } catch (err) {
      console.log(err);
      queue.delete(message.guild.id);
      return message.channel.send(err);
    }
  } else {
    serverQueue.songs.push(song);
    let msg = new Discord.MessageEmbed()
      .setColor("#00FFFF")
      .setTitle("Adicionado à playlist!")
      .setAuthor("Astronaut", "https://i.imgur.com/Dv0JT72.png")
      .setThumbnail(song.thumbnail)
      .addField(`${song.author}`, `${song.title}`)
      .setTimestamp()
      .setFooter("Astronaut");
    return message.channel.send({ embed: msg });
  }
}
async function searchVideo(message, serverQueue) {
  const args = message.content.split(" ");

  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) {
    return message.channel.send(
      "Você precisa estar em um canal de voz para procurar uma música!"
    );
  }
  const permissions = voiceChannel.permissionsFor(message.client.user);
  if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
    return message.channel.send(
      "Eu preciso de permissão para entrar e falar no seu canal de voz!"
    );
  }

  if (args.length < 2)
    return message.channel.send(
      "Você precisa informar qual música eu devo procurar!"
    );

  let song;
  if (ytdl.validateURL(args[1])) {
    return message.channel.send(
      'Para reproduzir um link, você precisa usar o comando "!play".'
    );
  } else {
    const { videos } = await yts(args.slice(1).join(" "));
    if (!videos.length)
      return message.channel.send("Nenhuma música foi encontrada!");

    let list = [];
    let listFields = [];
    for (let i = 0; i < 10; i++) {
      list.push({
        title: videos[i].title,
        url: videos[i].url,
        thumbnail: videos[i].thumbnail,
        author: videos[i].author.name,
      });
      listFields.push({
        name: videos[i].author.name,
        value: `${i + 1} - ${videos[i].title}`,
      });
    }
    let msg = new Discord.MessageEmbed()
      .setColor("#00FFFF")
      .setTitle("Resultado da pesquisa.")
      .setAuthor("Astronaut", "https://i.imgur.com/Dv0JT72.png")
      .addFields(listFields)
      .setTimestamp()
      .setFooter("Astronaut");

    message.channel.send({ embed: msg });

    const filter = (m) => m.author.id === message.author.id;
    const collector = message.channel.createMessageCollector(filter, {
      time: 30000,
    });
    collector.on("collect", async (m) => {
      collector.stop();
      if (!parseInt(m.content)) return;
      let indice = parseInt(m.content);
      if (indice < 1 || indice > 10) {
        return message.channel.send("Você deve escolher entre 1 e 10.");
      }
      song = {
        title: videos[indice - 1].title,
        url: videos[indice - 1].url,
        thumbnail: videos[indice - 1].thumbnail,
        author: videos[indice - 1].author.name,
      };

      if (!serverQueue) {
        const queueContruct = {
          textChannel: message.channel,
          voiceChannel: voiceChannel,
          connection: null,
          songs: [],
          volume: 5,
          playing: true,
        };

        queue.set(message.guild.id, queueContruct);

        queueContruct.songs.push(song);

        try {
          var connection = await voiceChannel.join();
          queueContruct.connection = connection;
          play(message.guild, queueContruct.songs[0]);
        } catch (err) {
          console.log(err);
          queue.delete(message.guild.id);
          return message.channel.send(err);
        }
      } else {
        serverQueue.songs.push(song);
        let msg = new Discord.MessageEmbed()
          .setColor("#00FFFF")
          .setTitle("Adicionado à playlist!")
          .setAuthor("Astronaut", "https://i.imgur.com/Dv0JT72.png")
          .setThumbnail(song.thumbnail)
          .addField(`${song.author}`, `${song.title}`)
          .setTimestamp()
          .setFooter("Astronaut");

        return message.channel.send({ embed: msg });
      }
    });
    collector.on("end", (collected) => {
      console.log("Collected: " + collected);
    });
  }
}
function playlist(message, serverQueue) {
  if (!message.member.voice.channel)
    return message.channel.send(
      "Você precisa estar em um canal de voz para parar a musica!"
    );
  if (!serverQueue) return message.channel.send("Nenhuma música na lista!");

  let songsInfo = [];
  for (let i = 0; i < serverQueue.songs.length; i++) {
    songsInfo.push({
      name: serverQueue.songs[i].author,
      value: `${i + 1} - ${serverQueue.songs[i].title}`,
    });
  }
  let embedMessage = new Discord.MessageEmbed()
    .setColor("#00FFFF")
    .setTitle("Playlist")
    .setAuthor("Astronaut", "https://i.imgur.com/Dv0JT72.png")
    .setThumbnail(serverQueue.songs[0].thumbnail)
    .addFields(songsInfo)
    .setTimestamp()
    .setFooter("Astronaut");

  return message.channel.send({ embed: embedMessage });
}
function skip(message, serverQueue) {
  const args = message.content.split(" ");
  if (!message.member.voice.channel)
    return message.channel.send(
      "Você precisa estar em um canal de voz para pular a música!"
    );
  if (!serverQueue) return message.channel.send("Nenhuma música para pular!");

  let indice;
  if (parseInt(args[1])) {
    indice = parseInt(args[1]);
    if (serverQueue.songs.length < indice)
      return message.channel.send("Não existe musica nessa posição!");
    let songs = serverQueue.songs.slice(indice - 1);
    serverQueue.songs = songs;
    play(message.guild, serverQueue.songs[0]);
  } else {
    if (args.length > 1) {
      return message.channel.send(
        "Argumento inválido! Você precisa informar um numero!"
      );
    } else {
      if (serverQueue.songs.length > 1) {
        serverQueue.connection.dispatcher.end();
      } else {
        return message.channel.send(
          'Essa é a última música, você deveria usar o comando "!stop" para interromper a reprodução de música!'
        );
      }
    }
  }
}
function stop(message, serverQueue) {
  if (!message.member.voice.channel)
    return message.channel.send(
      "Você precisa estar em um canal de voz para parar a musica!"
    );
  if (!serverQueue) return message.channel.send("Nenhuma música reproduzindo!");

  serverQueue.songs = [];
  serverQueue.connection.dispatcher.end();
}
function play(guild, song) {
  const serverQueue = queue.get(guild.id);
  if (!song) {
    serverQueue.voiceChannel.leave();
    queue.delete(guild.id);
    return;
  }

  const dispatcher = serverQueue.connection
    .play(ytdl(song.url))
    .on("finish", () => {
      serverQueue.songs.shift();
      play(guild, serverQueue.songs[0]);
    })
    .on("error", (error) => console.error(error));
  dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
  let msg = new Discord.MessageEmbed()
    .setColor("#00FFFF")
    .setTitle("Tocando!")
    .setAuthor("Astronaut", "https://i.imgur.com/Dv0JT72.png")
    .setThumbnail(song.thumbnail)
    .addField(`${song.author}`, `${song.title}`)
    .setTimestamp()
    .setFooter("Astronaut");
  serverQueue.textChannel.send({ embed: msg });
}
bot.login(token);

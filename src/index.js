const {Client, Events, GatewayIntentBits, EmbedBuilder} = require('discord.js');
require('dotenv').config();
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

const client = new Client({intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]});

client.once(Events.ClientReady, readyClient => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

const isIMDBUrl = (url) => {
    const imdbRegex = /^https?:\/\/(www\.)?(m\.)?imdb\.com\/title/i;
    return imdbRegex.test(url);
};
const getFirstIMDBUrl = (message) => {
    const messageArray = message.split(' ');
    return messageArray.find((word) => isIMDBUrl(word));
}


getTitle = async (page) => {
    try {
        return await page.title();
    } catch (e) {
        return '';
    }

}
getDescription = async (page) => {
    try {
        return await page.$eval('.sc-466bb6c-0', text => text.textContent);
    } catch (e) {
        return '';
    }
}
getImageUrl = async (page) => {
    try {
        return await page.$eval("head > meta[property='og:image']", el => el.content);
    } catch (e) {
        return '';
    }
}
getRating = async (page) => {
    try {
        const content = await page.$eval("head > meta[property='og:title']", el => el.content);
        const regex = /⭐\s(\d+\.\d+)/;
        const rating = content.match(regex);
        if (rating && rating[1]) {
            return rating[1];
        }
        return '';
    } catch (e) {
        return '';
    }
}
getGenres = async (page) => {
    try {
        const content = await page.$eval("head > meta[property='og:title']", el => el.content);
        const regex = /\|\s([^"]+)/;
        const genres = content.match(regex);
        if (genres && genres[1]) {
            return genres[1].split(',').map(genre => genre.trim());
        }
        return '';
    } catch (e) {
        return '';
    }
}
const getDuration = async (page) => {
    try {
        const content = await page.$eval("head > meta[property='og:description']", el => el.content);
        const regex = /\b(\d+h)? ?(\d+m)?\b/;
        const durationMatch = content.match(regex);
        if (durationMatch) {
            const hours = durationMatch[1] || '';
            const minutes = durationMatch[2];
            return `${hours ? hours : ''} ${minutes ? minutes : ''}`;
        }
        return '';
    } catch (e) {
        return '';
    }
};

const openPage = async (url) => {
    const browser = await puppeteer.launch({headless: 'new'});
    const page = await browser.newPage();
    await page.goto(url);
    return {browser, page};
}

const addLeftSpaces = (inputString) => {
    const minLength = 7;
    const spacesNeeded = Math.max(minLength - inputString.length, 0);
    return '\xa0'.repeat(spacesNeeded) + inputString;
};


client.on(Events.MessageCreate, async (message) => {
    if (message.channelId === process.env.MOVIES_CHANNEL_ID) {
        if (isIMDBUrl(message.content)) {
            const filmUrl = getFirstIMDBUrl(message.content);
            if (!filmUrl) return;
            const {page, browser} = await openPage(filmUrl);

            try {
                const [title, image, description, rating, duration, genres
                ] = await Promise.all([
                    getTitle(page),
                    getImageUrl(page),
                    getDescription(page),
                    getRating(page),
                    getDuration(page),
                    getGenres(page)
                ])
                const embed = new EmbedBuilder()
                    .setTitle(title)
                    .setThumbnail(image)
                    .setURL(filmUrl)
                    .setColor(0xF5C518)
                    .setAuthor({
                        name: message.author.globalName,
                        iconURL: `https://cdn.discordapp.com/avatars/${message.author.id}/${message.author.avatar}.png`
                    })
                if (genres.length > 0) {
                    embed.addFields({name: genres.join(' | '), value: '\u200B'})
                }
                if (description) {
                    embed.setDescription(description)
                }
                if (rating && duration) {
                    embed.addFields(
                        {
                            name: `:star: Rating ${' '.repeat(5)} :hourglass: Duration`,
                            value: `${'\u200B '.repeat(4)} **${rating}**/10${'\xa0'.repeat(14)} ${addLeftSpaces(duration)}`,
                            inline: true
                        })
                } else if (rating) {
                    embed.addFields(
                        {
                            name: `:star: Rating`,
                            value: `${'\u200B '.repeat(4)} **${rating}**/10`,
                            inline: true
                        })
                } else if (duration) {
                    embed.addFields(
                        {
                            name: `:hourglass: Duration`,
                            value: `${'\u200B '.repeat(4)} ${addLeftSpaces(duration)}`,
                            inline: true
                        })
                }
                await message.delete();
                await message.channel.send({embeds: [embed]});

            } catch (e) {
                console.error(e);
            } finally {
                await browser.close();
            }
        }
    }
});

client.login(process.env.DISCORD_TOKEN).then(() => console.log('Logged in'));
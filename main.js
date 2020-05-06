const axios = require('axios').default;
const cheerio = require('cheerio');
const fs = require('fs');

/**
 * @typedef {Object} Theme
 * @property {String} name Song type, number and title e.g. 
 * - OP1 "sister's noise"
 * @property {String} link Direct link to webm video on animethemes.moe
 * @property {('opening'|'ending')} type Song type
 * - opening
 * - ending
 * @property {String} episodes Episodes with this theme
 * @property {String} notes Additional notes (NSFW, Spoilers)
 */

/**
 * @typedef {Object} Anime
 * @property {String} id MyAnimeList ID
 * @property {String} title Anime title, usually in romaji
 * @property {String} year Anime release year or decade if 1999 or older (XXs, e.g. 90s) 
 * @property {Array<Theme>} themes Themes
 */


/** Class representing theme parser */
class ThemeParser {
    constructor() {
        this.baseUrl = 'https://reddit.com';
    }

    /**
     * Get all themes available
     * @returns {Promise<Array<Anime>>}
     */
    async all() {
        try {
            // Fetching year links
            this.animes = [];
            let resp = await axios.get("https://reddit.com/r/AnimeThemes/wiki/year_index.json", {
                headers: {
                    "User-Agent": "animethemes-scraper 1.0"
                }
            })

            let html = resp.data.data.content_html;
            html = getHTML(html);
            this.$ = cheerio.load(html);

            let data = await this.parseLinks(); // Parse each year

            return data;
        }
        catch(err) {
            throw err;
        }
    }

    /** 
     * Get all animes from a year
     * @param {Number} n Year
     * @returns {Promise<Array<Anime>>}
     */
    async year(n) {
        let animes = [];

        let y = await biribiri('/r/AnimeThemes/wiki/'+n) // Fetch and parse wiki page
    
        this.$ = y;
        
        y('h3').each((i, el) => { // Each series in year
            let parsed = this.parseAnime(el);
            parsed.year = n;
            animes.push(parsed);
        })
            
        return animes;
    }

    parseLinks() {
        return new Promise(async resolve => {
            let years = this.$('h3 a'); // All year links
            this.finl = 0; // Finished tasks counter

            years.each(async (i, yearElement) => { // Each year
                this.year(this.$(yearElement).attr('href').split('/')[4]) // Parse this year
                .then(animes => {
                    this.animes = this.animes.concat(animes); // Add animes from this year to array
                    this.finl++; // Finished parsing

                    if(this.finl == years.length) { // If everything is finished 
                        resolve(this.animes); // Return 
                    }
                })       
            });
        })
    }

    /**
     * @returns {Anime} 
     */
    parseAnime(dat) {
        let el = this.$(dat).children('a'); // Title element
        let title = el.text(); // Title
        let malId = el.attr('href').split('/')[4]; // Title link - mal id
        let next = this.$(dat).next(); // Next element - other titles or table

        let theme = {
            id: malId,
            title
        }

        if (next.prop("tagName") == "P") { // If next element is other titles
            theme.themes = this.parseTable(next.next()); // Next element should be a table
        } else if (next.prop("tagName") == "TABLE") { // Next element is table
            theme.themes = this.parseTable(next); // Parse table
        }

        return theme;
    }

    parseTable(table) {
        if (table.prop('tagName') != "TABLE") { // If for some reason it's not a table, check next element
            return this.parseTable(table.next());
        }

        let themes = [];

        table.children('tbody').children('tr').each(function (i) { // For each theme
            const $ = cheerio.load(this);
            const td = $('td'); // Theme row
            let name = replaceAll(td.first().text(), "&quot;", "\""); // Theme name
            let link = td.eq(1).children().first().attr('href'); // animethemes.moe link
            let episodes = td.eq(2).text(); // Episode notes
            let notes = td.eq(3).text(); // Additional notes

            // Push theme to array of themes
            themes.push({
                name,
                link,
                type: (name.startsWith('OP') ? 'opening' : 'ending'),
                episodes,
                notes
            })
        })

        return themes; // Return all themes of this anime
    }
}

// Running from command line
if (require.main === module) {
    let parser = new ThemeParser();
    parser.all() // Parse all themes
        .then(a => { 
            fs.writeFileSync('./output.json', JSON.stringify(a)) // and save to file
            console.log("Parsed " + a.length  + " anime. Written to output.json")
        })
}

/** 
 * @param {string} href Wiki page path
 */
async function biribiri(href) {
    let resp = await axios.get("https://reddit.com" + href + ".json", {
        headers: {
            "User-Agent": "animethemes-scraper 1.0"
        }
    })

    return cheerio.load(getHTML(resp.data.data.content_html));
}

/**
 * @param {Cheerio} table Cheerio with loaded <table>
 */
function getHTML(str) {
    let html = replaceAll(str, "&lt;", "<")
    html = replaceAll(html, "&gt;", ">")
    return html;
}

/**
 * 
 * @param {*} str 
 * @param {*} find 
 * @param {*} replace 
 * @returns {string} replaced
 */
function replaceAll(str, find, replace) {
    return str.replace(new RegExp(find, 'g'), replace);
}

module.exports = ThemeParser; // For importing in code
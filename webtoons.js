const mangayomiSources = [{
    "name": "Webtoons",
    "lang": "en",
    "baseUrl": "https://www.webtoons.com",
    "apiUrl": "",
    "iconUrl": "https://upload.wikimedia.org/wikipedia/commons/0/09/Naver_Line_Webtoon_logo.png",
    "typeSource": "single",
    "isManga": true,
    "isNsfw": false,
    "version": "0.0.1",
    "dateFormat": "",
    "dateFormatLocale": "",
    "pkgPath": "https://github.com/uwu-wuw/mangayomi-extension/edit/main/webtoons.js"
}];

class DefaultExtension extends MProvider {
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36"
    };
    getHeaders(url) {
        return {
            Referer: this.source.baseUrl
        }
    }

    async getItem(url, p) {
        const res = await new Client().get(this.source.baseUrl + url, this.headers);
        const doc = new Document(res.body);
        const mangas = [];
        const elements = doc.select(p);
        for (const element of elements) {
            const linkElement = element.selectFirst("a");
            const imageElement = linkElement.selectFirst("img");
            const imageUrl = imageElement.attr("src");
            const name = element.selectFirst("p.subj").text;
            const link = linkElement.attr("href");
            const genre = [];
            if (element.selectFirst("p.genre").text === "") {
                genre.push(element.selectFirst("span.genre").text);
            } else {
                genre.push(element.selectFirst("p.genre").text);
            }
            mangas.push({
                name: name,
                imageUrl: imageUrl,
                link: link,
                genre: genre
            });
        }
        return mangas;
    }

    async getPopular(page) {
        const baseUrl = this.source.baseUrl;
        const client = new Client();
        const res = await client.get(`${baseUrl}/en/originals`);
        const doc = new Document(res.body);

        const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
        let dayElements = [];

        for (const day of days) {
            const elements = doc.select(`div.daily_section._list_${day} li`);
            dayElements.push(elements);
        }

        const maxElements = Math.max(...dayElements.map(elements => elements.length));
        let list = [];
        for (let i = 0; i < maxElements; i++) {
            for (let j = 0; j < days.length; j++) {
                const elements = dayElements[j];
                if (i < elements.length) {
                    const element = elements[i];
                    const linkElement = element.selectFirst("a");
                    const imageElement = linkElement.selectFirst("img");
                    const imageUrl = imageElement.attr("src");
                    const name = element.selectFirst("p.subj").text;
                    const link = linkElement.attr("href");
                    list.push({ name, imageUrl, link });
                }
            }
        }

        const completed = doc.select("div.daily_lst.comp li");
        for (const element of completed) {
            const linkElement = element.selectFirst("a");
            const imageElement = linkElement.selectFirst("img");
            const imageUrl = imageElement.attr("src");
            const name = element.selectFirst("p.subj").text;
            const link = linkElement.attr("href");
            list.push({ name, imageUrl, link });
        }

        return {
            list: list,
            hasNextPage: false
        };
    }

    async getLatestUpdates(page) {
        const Day = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

        const list = await this.getItem(`/en/originals?sortOrder=UPDATE`, "div.daily_section._list_" + Day[new Date().getDay()] + " li");
        return {
            list: list,
            hasNextPage: false
        };
    }

    async search(query, page, filters) {
        let keyword = query.trim().replace(/\s+/g, '+');
        let hasNextPage = true;
        let type_originals = "WEBTOON";
        let type_canvas = "CHALLENGE";
        let fetch_originals = "ul.card_lst li";
        let fetch_canvas = "div.challenge_lst.search li";
        let list_originals = [];
        let list_canvas = [];
        let list = [];

        if (query !== "") {
            list_originals = await this.getItem(`/en/search?keyword=${keyword}&searchType=` + type_originals + `&page=${page}`, fetch_originals);
            list_canvas = await this.getItem(`/en/search?keyword=${keyword}&searchType=` + type_canvas + `&page=${page}`, fetch_canvas);
            if (filters) { }
            list = list_originals.concat(list_canvas);
        } else {

        }

        if (list.length === 0) { hasNextPage = false; }
        return {
            list: list,
            hasNextPage: hasNextPage
        };
    }

    async getDetail(url) {
        function formatDateString(dateStr) {
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const parts = dateStr.split(' ');

            if (parts.length === 3) {
                const month = months.indexOf(parts[0]) + 1;
                const day = parts[1].replace(',', '');
                const year = parts[2];
                return `${year}-${month.toString().padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
            return dateStr;
        }
        const res = await new Client().get(url);
        const doc = new Document(res.body);
        const info = doc.selectFirst("div.cont_box");
        const cover = info.selectFirst("span.thmb img").attr('src') ?? (info.selectFirst("div.detail_body.banner").attr('style').match(/url\(["']?([^"')]+)["']?\)/))[1];
        const title = info.selectFirst("h1.subj, h3.subj").text.trim();
        const genre = Array.from(info.select("p.genre")).map(el => el.text) != '' ? Array.from(info.select("p.genre")).map(el => el.text) : [info.selectFirst("div.info h2").text];
        const author = info.selectFirst("div.author_area").text.replace(/\s+/g, ' ').replace(/author info/g, '').trim() ?? info.selectFirst("a.author").text;
        const status_str = info.selectFirst("p.day_info").text;
        var status;
        if (status_str == "COMPLETED") {
            status = 1;
        } else {
            status = 0;
        }
        const desc = info.selectFirst("p.summary").text.replace(/\s+/g, ' ').trim();
        const chapters = [];
        let tester = "";
        let page = 1;

        while (tester !== "#1") {
            const res = await new Client().get(url + `&page=${page}`);
            const doc = new Document(res.body);
            const info = doc.selectFirst("div.cont_box");
            const elements = info.select("div.detail_lst li");

            for (const element of elements) {
                tester = element.selectFirst("span.tx").text.trim();
                const dateString = element.selectFirst("span.date").text.trim();
                const date = new Date(formatDateString(dateString));
                const millisecondsSinceEpoch = date.getTime();
                const millisecondsString = millisecondsSinceEpoch.toString();
                chapters.push({
                    name: tester + " " + element.selectFirst("span.subj span").text,
                    url: element.selectFirst('a').attr("href"),
                    dateUpload: millisecondsString
                });
            }
            page++;
        }
        return {
            name: title,
            link: url,
            genre: genre,
            imageUrl: cover,
            description: desc,
            author: author,
            status: status,
            episodes: chapters
        };
    }

    async getPageList(url) {
        const preference = new SharedPreferences();
        const res = await new Client().get(url);
        const doc = new Document(res.body);
        const urls = [];
        const imageElement = doc.selectFirst('div#_imageList');
        const img_urls = imageElement.select('img');
        for (let i = 0; i < img_urls.length; i++) {
            urls.push(img_urls[i].attr("data-url"));
        }
        return urls;
    }



    getFilterList() {
        return [{
            type: "sort",
            name: "Official or Challenge",
            type_name: "SelectFilter",
            values: [{
                type_name: "SelectOption",
                name: "Any",
                value: "any"
            },
            {
                type_name: "SelectOption",
                name: "Official only",
                value: "official"
            },
            {
                type_name: "SelectOption",
                name: "Challenge only",
                value: "challenge"
            }]
        },
        {
            type: "categories",
            name: "Genre",
            type_name: "SelectFilter",
            values: [{
                type_name: "SelectOption",
                name: "All",
                value: ""
            },
            {
                type_name: "SelectOption",
                name: "Action",
                value: "action"
            },
            {
                type_name: "SelectOption",
                name: "Comedy",
                value: "comedy"
            },
            {
                type_name: "SelectOption",
                name: "Drama",
                value: "drama"
            },
            {
                type_name: "SelectOption",
                name: "Fantasy",
                value: "fantasy"
            },
            {
                type_name: "SelectOption",
                name: "Heartwarming",
                value: "heartwarming"
            },
            {
                type_name: "SelectOption",
                name: "Historical",
                value: "historical"
            },
            {
                type_name: "SelectOption",
                name: "Horror",
                value: "horror"
            },
            {
                type_name: "SelectOption",
                name: "Informative",
                value: "tiptoon"
            },
            {
                type_name: "SelectOption",
                name: "Mystery",
                value: "mystery"
            },
            {
                type_name: "SelectOption",
                name: "Romance",
                value: "romance"
            },
            {
                type_name: "SelectOption",
                name: "Sci-fi",
                value: "sf"
            },
            {
                type_name: "SelectOption",
                name: "Slice of life",
                value: "slice_of_life"
            },
            {
                type_name: "SelectOption",
                name: "Sports",
                value: "sports"
            },
            {
                type_name: "SelectOption",
                name: "Superhero",
                value: "super_hero"
            },
            {
                type_name: "SelectOption",
                name: "Supernatural",
                value: "supernatural"
            }]
        }
        ];
    }

    getSourcePreferences() {
        throw new Error("getSourcePreferences not implemented");
    }
}

/*
Start making Packs!
Try out the hello world sample below to create your first build.
*/

// This import statement gives you access to all parts of the Coda Packs SDK.
import * as coda from "@codahq/packs-sdk";
import { parse } from 'node-html-parser';

// This line creates your new Pack.
export const pack = coda.newPack();

pack.addNetworkDomain("goodreads.com");

const RATING_MAP = {
  'it was amazing': 5,
  'really liked it': 4,
  'liked it': 3,
  'it was ok': 2,
  'did not like it': 1,
  undefined: undefined,
}

// TODO maybe make this an optional parameter
const PER_PAGE = 10

function rowToBook(bookRow, shelf) {
  const relLink = bookRow.querySelector('.title').querySelector('.value').querySelector('a').getAttribute('href').trim();
  return {
    link: `https://goodreads.com${relLink}`,
    coverUrl: bookRow.querySelector('.cover').querySelector('.value').querySelector('div').querySelector('a').querySelector('img').getAttribute('src').trim(),
    title: bookRow.querySelector('.title').querySelector('.value').querySelector('a').text.trim(),
    firstAuthor: bookRow.querySelector('.author').querySelector('.value').querySelector('a').text.trim(),
    isbn: bookRow.querySelector('.isbn').querySelector('.value').text.trim(),
    isbn13: bookRow.querySelector('.isbn13').querySelector('.value').text.trim(),
    rating: RATING_MAP[bookRow.querySelector('.rating').querySelector('.value').querySelector('.staticStars').getAttribute('title')?.trim()],
    avgRating: parseFloat(bookRow.querySelector('.avg_rating').querySelector('.value').text.trim()),
    shelf,
    dateRead: bookRow.querySelector('.date_read').querySelector('.value').querySelector('span')?.getAttribute('title')?.trim(),
    dateAdded: bookRow.querySelector('.date_added').querySelector('.value').querySelector('span')?.getAttribute('title')?.trim(),
  }
}

function pageToBook(bookResponse, url) {
  return {
    link: url,
    coverUrl: bookResponse.querySelector('.BookCover__image').querySelector('.ResponsiveImage').getAttribute('src').trim(),
    title: bookResponse.querySelector('.BookPageTitleSection__title').querySelector('.Text__title1').text.trim(),
    firstAuthor: bookResponse.querySelector('.BookPageMetadataSection__contributor').querySelector('.ContributorLinksList').querySelector('.ContributorLink__name').text.trim(),
    isbn: JSON.parse(bookResponse.querySelector('[type="application/ld+json"]').text.trim())["isbn"],
    avgRating: parseFloat(bookResponse.querySelector('.RatingStatistics__rating').text.trim()),
  }
}

const BookSchema = coda.makeObjectSchema({
  properties: {
    link: { type: coda.ValueType.String, codaType: coda.ValueHintType.Url },
    coverUrl: { type: coda.ValueType.String, codaType: coda.ValueHintType.ImageReference},
    title: { type: coda.ValueType.String },
    firstAuthor: { type: coda.ValueType.String },
    isbn: { type: coda.ValueType.String },
    isbn13: { type: coda.ValueType.String },
    rating: { type: coda.ValueType.Number },
    avgRating: { type: coda.ValueType.Number },
    shelf: { type: coda.ValueType.String },
    dateRead: { type: coda.ValueType.String },
    dateAdded: { type: coda.ValueType.String },
  },
  displayProperty: "title",
  linkProperty: "link",
  subtitleProperties: ["firstAuthor", "rating", "shelf"],
  imageProperty: "coverUrl",
  idProperty: "link",
  featuredProperties: ["title", "firstAuthor", "rating", "shelf", "link"]
});

pack.addFormula({
  name: "book",
  description: "get a book by link",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "link",
      description: "goodreads book link",
    })
  ],
  resultType: coda.ValueType.Object,
  schema: BookSchema,
  execute: async function ([link], context) {
    const url = link.split(/[?#]/)[0];
    const response = await context.fetcher.fetch({
      method: "GET",
      url,
    });
    return pageToBook(parse(response.body), url)
  }
});

pack.addColumnFormat({
  name: "book",
  formulaName: "book",
  instructions: "get a book by link",
  matchers: [
    /^https:\/\/.+\.goodreads\.com\/book\/show\/[0-9]*.*/i,
  ]
});

pack.addSyncTable({
  name: "Books",
  schema: BookSchema,
  identityName: "Book",
  formula: {
    name: "scrape",
    description: "scrape goodreads",

    parameters: [
      coda.makeParameter({
        type: coda.ParameterType.String,
        name: "userId",
        description: "user id",
      })
    ],

    execute: async function ([userId], context) {
      let page = 1;
      const {continuation} = context.sync
      if (continuation){
        page = continuation.page as number
      }

      const readResponse = await context.fetcher.fetch({
        method: "GET",
        url: `https://www.goodreads.com/review/list/${userId}?shelf=read&per_page=${PER_PAGE}&page=${page}`,
      });
      const readBooks = parse(readResponse.body).querySelector("#booksBody").querySelectorAll('tr').map(row => rowToBook(row, "read"))

      let currentlyReadingResponse = await context.fetcher.fetch({
        method: "GET",
        url: `https://www.goodreads.com/review/list/${userId}?shelf=currently-reading&per_page=${PER_PAGE}&page=${page}`,
      });
      const readingBooks = parse(currentlyReadingResponse.body).querySelector("#booksBody").querySelectorAll('tr').map(row => rowToBook(row, "reading"))

      let toReadResponse = await context.fetcher.fetch({
        method: "GET",
        url: `https://www.goodreads.com/review/list/${userId}?shelf=to-read&per_page=${PER_PAGE}&page=${page}`,
      });
      const toReadBooks = parse(toReadResponse.body).querySelector("#booksBody").querySelectorAll('tr').map(row => rowToBook(row, "to read"))

      let nextContinuation;
      if (readBooks.length !== 0 || readingBooks.length !== 0 || toReadBooks.length !== 0) {
        nextContinuation = {
          page: page + 1
        }
      }
      return {
        result: [
          ...readBooks,
          ...readingBooks,
          ...toReadBooks
        ],
        continuation: nextContinuation
      };
    },
  },
});


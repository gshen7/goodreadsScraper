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

function rowToBook(bookRow, shelf) {
  const title = bookRow.querySelector('.title').querySelector('.value').querySelector('a').text.trim();
  const author = bookRow.querySelector('.author').querySelector('.value').querySelector('a').text.trim();
  const isbn = bookRow.querySelector('.isbn').querySelector('.value').text.trim();
  const id = `${isbn}:${title}:by:${author}`
  return {
    id,
    coverUrl: bookRow.querySelector('.cover').querySelector('.value').querySelector('div').querySelector('a').querySelector('img').getAttribute('src').trim(),
    title,
    author,
    isbn,
    isbn13: bookRow.querySelector('.isbn13').querySelector('.value').text.trim(),
    rating: RATING_MAP[bookRow.querySelector('.rating').querySelector('.value').querySelector('.staticStars').getAttribute('title')?.trim()],
    avgRating: parseFloat(bookRow.querySelector('.avg_rating').querySelector('.value').text.trim()),
    shelf,
  }
}

const BookSchema = coda.makeObjectSchema({
  properties: {
    id: { type: coda.ValueType.String },
    coverUrl: { type: coda.ValueType.String, codaType: coda.ValueHintType.ImageReference},
    title: { type: coda.ValueType.String },
    author: { type: coda.ValueType.String },
    isbn: { type: coda.ValueType.String },
    isbn13: { type: coda.ValueType.String },
    rating: { type: coda.ValueType.Number },
    avgRating: { type: coda.ValueType.Number },
    shelf: { type: coda.ValueType.String },
  },
  displayProperty: "title",
  idProperty: "id",
  featuredProperties: ["title", "author", "rating", "shelf"]
});

pack.addSyncTable({
  name: "Books",
  schema: BookSchema,
  identityName: "Book",
  formula: {
    // This is the name that will be called in the formula builder.
    // Remember, your formula name cannot have spaces in it.
    name: "scrape",
    description: "scrape goodreads",

    // If your formula requires one or more inputs, you’ll define them here.
    // Here, we're creating a string input called “name”.
    parameters: [
      coda.makeParameter({
        type: coda.ParameterType.String,
        name: "userId",
        description: "user id",
      })
    ],

    // The resultType defines what will be returned in your Coda doc. Here, we're
    // returning a simple text string.
    resultType: coda.ValueType.String,

    // Everything inside this execute statement will happen anytime your Coda
    // formula is called in a doc. An array of all user inputs is always the 1st
    // parameter.
    execute: async function ([userId], context) {
      const readResponse = await context.fetcher.fetch({
        method: "GET",
        url: `https://www.goodreads.com/review/list/${userId}?shelf=read&per_page=infinite`,
      });
      const readBooks = parse(readResponse.body).querySelector("#booksBody").querySelectorAll('tr').map(row => rowToBook(row, "read"))

      let currentlyReadingResponse = await context.fetcher.fetch({
        method: "GET",
        url: `https://www.goodreads.com/review/list/${userId}?shelf=currently-reading&per_page=infinite`,
      });
      const readingBooks = parse(currentlyReadingResponse.body).querySelector("#booksBody").querySelectorAll('tr').map(row => rowToBook(row, "reading"))

      let toReadResponse = await context.fetcher.fetch({
        method: "GET",
        url: `https://www.goodreads.com/review/list/${userId}?shelf=to-read&per_page=infinite`,
      });
      const toReadBooks = parse(toReadResponse.body).querySelector("#booksBody").querySelectorAll('tr').map(row => rowToBook(row, "to read"))

      return {
        result: [
          ...readBooks,
          ...readingBooks,
          ...toReadBooks
        ]
      };
    },
  },
});


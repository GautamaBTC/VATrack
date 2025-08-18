#!/bin/bash
npm install
export DATABASE_URL='postgresql://neondb_owner:npg_ru1gsY3myUfa@ep-winter-sky-a2k1vnk3-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require'
node server.js > node_output.log 2>&1

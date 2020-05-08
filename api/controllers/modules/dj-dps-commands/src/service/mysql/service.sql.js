// get the client

const mysql = require('mysql2');
const moment = require("moment");
const _ = require("lodash");


// create the connection pool
const connectionUrl =
    process.env.JAWSDB_URL ||
    'mysql://root:boldak@localhost:3306/x4mspp0ssyvlauv8'

const pool = mysql.createPool({
  uri:connectionUrl,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});



class SqlImplError extends Error {
    constructor(message) {
        super(message);
        this.name = "sql service error";
    }
}



let Table = require('cli-table3')


let formatValue = (value, type) => {
    
    let dataTypeFormat = {
        10: "YYYY-MM-DD",
        12: "YYYY-MM-DD HH:mm:ss",
        11: "HH:mm:ss",
        7: "",
        13: "YYYY"
    }

    if( dataTypeFormat[type]){
        let d = (type == 11) 
            ? (value) ? new moment(value.toString(), "HH:mm:ss") : "null"
            : (type == 13)
                ? (value) ? new moment(value.toString()+"01-01", "YYYY-MM-DD") : "null"
                : (value) ? moment(new Date(value)) : "null" 
        return (d.format) ? d.format(dataTypeFormat[type]) : d
    } 
    return (value) ? value.toString() : "null"
}


module.exports = {
    name: "service.sql",

    synonims: {
        "service.sql": "service.sql",
        "service.mysql": "service.sql",
    },

    "internal aliases": {
        "query": "query",
        "selector": "query",
        "permission":"permission",
        "available":"permission"
    },

    defaultProperty: {
        "service.sql": "query",
        "service.mysql": "query"
    },

    execute: function(command, state, config) {

        command.settings.query = command.settings.query || ((command.settings.data) ? command.settings.data : state.head.data)
        command.settings.permission = command.settings.permission || [] 
        command.settings.permission = command.settings.permission.map( p => p.toUpperCase())
        if (!command.settings.query) {
            throw new SqlImplError("no query available")
        }
        let connection    
        return new Promise((resolve, reject) => {
            pool.promise().getConnection()
                .then(c  => {
                    connection = c
                    return connection.query({sql:command.settings.query, nestTables:"."})
                })
                .then(([results, fields]) => {
                    connection.release()
                      if (!_.isArray(results)) {
                      
                          return {
                              query: command.settings.query,
                              text: _.keys(results).map(k => `${k}: ${JSON.stringify(results[k])}`).join(", ") + "\n"
                          }
                      
                      } else {
                        var table = new Table();
                            table.push(fields.map(f => f.name))
                            results.forEach(row => {
                            table.push(_.values(row).map( ( v, index ) => formatValue(v, fields[index].columnType)))
                        })
                        
                        return {
                              query: command.settings.query,
                              fields: fields.map( f => ({name:f.name, columnType:f.columnType})),
                              data: results,
                              text: table.toString().replace(/\u001b\[90m/g,"").replace(/\u001b\[39m/g, "") + "\n"
                        }
                      }
                })
                .then(res => {
                    state.head = {
                        type: "json",
                        data: res
                    }
                    resolve(state)
                })
                .catch(err => {
                    connection.release()
                    reject(new SqlImplError(
                       (err.errno) ? `SQL Error ${err.errno}: ${err.sqlMessage}\n${command.settings.query}` : err.toString()
                    ))
                })
                        
            })
        },


    help: {
        synopsis: "Tokenize document",

        name: {
            "default": "rank",
            synonims: []
        },
        input: ["table"],
        output: "table",
        "default param": "indexes",
        params: [{
            name: "direction",
            synopsis: "Direction of iteration (optional)",
            type: ["Rows", "row", "Columns", "col"],
            synonims: ["direction", "dir", "for"],
            "default value": "Columns"
        }, {
            name: "indexes",
            synopsis: "Array of 0-based indexes of items that will be ranked (optional)",
            type: ["array of numbers"],
            synonims: ["indexes", "items"],
            "default value": []
        }, {
            name: "asc",
            synopsis: "Define order (optional)",
            type: ["A-Z", "az", "direct", "Z-A", "za", "inverse"],
            synonims: ["order", "as"],
            "default value": "A-Z"
        }],
        example: {
            description: "Rank first column values",
            code: "load(\r\n    ds:'47611d63-b230-11e6-8a1a-0f91ca29d77e_2016_02',\r\n    as:\"dataset\"\r\n)\r\nproj([\r\n  { dim:'time', role:'row', items:[] },\r\n  { dim:'indicator', role:'col', items:[] }\r\n])\r\n\r\nrank(for:\"col\",items:[0],as:\"az\")\r\n\r\norder(by:0, as:\"az\")\r\n\r\n"
        }
    }
}
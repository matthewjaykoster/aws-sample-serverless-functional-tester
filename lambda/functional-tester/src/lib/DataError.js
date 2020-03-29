/**
 * Extension of the basic Error allowing attached additional and arbitrary data when thrown.
 */
class DataError extends Error {
    constructor(message, data) {
        super(message);
        this.name = 'DataError';
        this.data = data;
    }
}

module.exports = DataError;
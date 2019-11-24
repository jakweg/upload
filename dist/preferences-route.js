"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bcrypt_1 = require("./bcrypt");
const configuration_1 = require("./configuration");
const global_1 = require("./global");
const database_1 = require("./database");
function init(app) {
    app.get('/preferences', (req, res) => res.redirect('/preferences/'));
    app.get('/preferences/:anything', (req, res) => res.redirect('/preferences/' + encodeURIComponent(req.params.anything) + '/'));
    app.get('/preferences/', (req, res) => global_1.withUser(req, res, user => {
        res.render('preferences', {
            pageTitle: 'Preferences of upload',
            partial: 'none',
        });
    }));
    const showAccountDetails = (res, user, isSelf) => {
        res.render('preferences', {
            pageTitle: 'Details of account',
            partial: 'my-account',
            uid: user.uid,
            usedBytes: user.usedBytes,
            quota: user.quota,
            isAdmin: user.isAdmin,
            isSelf: isSelf,
            files: user.filesList.length,
            maxFiles: user.maxFiles,
        });
    };
    const showChangingPassword = (res, user, isSelf) => {
        res.render('preferences', {
            pageTitle: `Changing ${isSelf ? 'your' : (user.uid + '\'s')} password`,
            partial: 'change-password',
            isSelf: isSelf,
        });
    };
    const handlePasswordChange = async (req, res, user, isSelf) => {
        if (user.uid === 'root' && !isSelf) {
            return res.status(403).render('error', {
                pageTitle: 'Error 403: Forbidden',
                errorText: 'You can\'t change root\'s password this way, sign in as root and go to My account -> Change password section',
            });
        }
        const oldPassword = req.body.currentPassword;
        const newPassword = req.body.newPassword;
        const newPassword2 = req.body.newPassword2;
        if ((!oldPassword && isSelf) || !newPassword || !newPassword2)
            return res.status(400).render('error', {
                pageTitle: 'Error 400: Bad request',
                errorText: 'Fill all inputs',
            });
        if (newPassword !== newPassword2)
            return res.status(400).render('error', {
                pageTitle: 'Error 400: Bad request',
                errorText: 'New password is different then retyped one',
            });
        if (isSelf && !await bcrypt_1.compareHashed(oldPassword, user.password))
            return res.status(400).render('error', {
                pageTitle: 'Error 400: Bad request',
                errorText: 'Old password doesn\'t match current one',
            });
        const salt = await bcrypt_1.generateSalt(configuration_1.BCRYPT_ROUNDS);
        // it automatically destroys sessions
        user.password = await bcrypt_1.hashData(newPassword, salt);
        return res.status(200).render('error', {
            pageTitle: '200: OK',
            errorText: (isSelf ? 'Your password' : 'Password') + ' has been changed',
            emoji: '🙂',
        });
    };
    app.get('/preferences/my-account/', (req, res) => global_1.withUser(req, res, user => showAccountDetails(res, user, true)));
    app.get('/preferences/my-account/change-password', (req, res) => global_1.withUser(req, res, user => showChangingPassword(res, user, true)));
    app.post('/preferences/my-account/change-password', global_1.POST_DATA_HANDLER, (req, res) => global_1.withUser(req, res, user => handlePasswordChange(req, res, user, true)));
    app.get('/preferences/add-user/', (req, res) => global_1.withAdminUser(req, res, () => {
        res.render('preferences', {
            pageTitle: 'Adding new user',
            partial: 'add-user',
        });
    }));
    app.post('/preferences/add-user/', global_1.POST_DATA_HANDLER, (req, res) => global_1.withAdminUser(req, res, async () => {
        const userName = req.body.userName;
        const password = req.body.password;
        const password2 = req.body.password2;
        if (!userName || !password || !password2)
            return res.status(400).render('error', {
                pageTitle: 'Error 400: Bad request',
                errorText: 'Fill all inputs',
            });
        if (password !== password2)
            return res.status(400).render('error', {
                pageTitle: 'Error 400: Bad request',
                errorText: 'Passwords are not equal',
            });
        try {
            const user = await database_1.INSTANCE.createUser(userName, password, configuration_1.DEFAULT_USER_QUOTA, configuration_1.DEFAULT_USER_FILES_LIMIT);
            res.redirect('/preferences/all-users/' + user.uid + '/');
        }
        catch (e) {
            res.status(400).render('error', {
                pageTitle: 'Error 400: Bad request',
                errorText: e.message,
            });
        }
    }));
    app.get('/preferences/all-users/', (req, res) => global_1.withAdminUser(req, res, () => {
        res.render('preferences', {
            pageTitle: 'List of users',
            partial: 'all-users',
            users: database_1.INSTANCE.allUserIds,
        });
    }));
    const withSelectedUser = async (req, res, then) => {
        const user = await database_1.INSTANCE.getUser(req.params.uid);
        if (user)
            then(user);
        else
            return res.status(404).render('error', {
                pageTitle: 'Error 404: User not found',
                errorText: 'User with this name wan\'t found on this server',
            });
    };
    app.get('/preferences/all-users/:uid/', (req, res) => global_1.withAdminUser(req, res, () => withSelectedUser(req, res, (user) => showAccountDetails(res, user, false))));
    app.get('/preferences/all-users/:uid/change-password', (req, res) => global_1.withAdminUser(req, res, () => withSelectedUser(req, res, (user) => showChangingPassword(res, user, false))));
    app.post('/preferences/all-users/:uid/change-password', global_1.POST_DATA_HANDLER, (req, res) => global_1.withAdminUser(req, res, () => withSelectedUser(req, res, (user) => handlePasswordChange(req, res, user, false))));
    app.get('/preferences/all-users/:uid/delete', (req, res) => global_1.withAdminUser(req, res, () => withSelectedUser(req, res, user => {
        res.render('preferences', {
            pageTitle: 'Deleting user',
            partial: 'delete-user',
            uid: user.uid,
            files: user.filesList.length,
        });
    })));
    app.post('/preferences/all-users/:uid/delete', global_1.POST_DATA_HANDLER, (req, res) => global_1.withAdminUser(req, res, () => withSelectedUser(req, res, async (user) => {
        try {
            if (req.body.proceed !== 'true')
                return res.redirect(303, 'delete');
            await user.deleteMe();
            res.render('error', {
                pageTitle: 'User deleted!',
                errorText: `User ${user.uid} has been deleted and so their all files`,
                emoji: '😯',
            });
        }
        catch (e) {
            res.status(500).render('error', {
                pageTitle: 'Can\'t delete user',
                errorText: e.message,
            });
        }
    })));
    app.get('/preferences/all-users/:uid/promote', (req, res) => global_1.withAdminUser(req, res, () => withSelectedUser(req, res, user => {
        res.render('preferences', {
            pageTitle: 'Change users\'s permissions',
            partial: 'promote-user',
            uid: user.uid,
            isAdmin: user.isAdmin,
        });
    })));
    app.post('/preferences/all-users/:uid/promote', global_1.POST_DATA_HANDLER, (req, res) => global_1.withAdminUser(req, res, () => withSelectedUser(req, res, async (user) => {
        try {
            if (req.body.proceed !== 'true')
                return res.redirect(303, 'promote');
            user.isAdmin = req.body.makeAdmin === 'true';
            res.redirect(303, '.');
        }
        catch (e) {
            res.status(500).render('error', {
                pageTitle: 'Can\'t change user\'s permissions',
                errorText: e.message,
            });
        }
    })));
    app.get('/preferences/all-users/:uid/change-limits', (req, res) => global_1.withAdminUser(req, res, () => withSelectedUser(req, res, user => {
        res.render('preferences', {
            pageTitle: 'Change users\'s limits',
            partial: 'change-limits',
            uid: user.uid,
            usedBytes: user.usedBytes,
            quota: user.quota,
            files: user.filesList.length,
            filesLimit: user.maxFiles,
        });
    })));
    app.post('/preferences/all-users/:uid/change-limits', global_1.POST_DATA_HANDLER, (req, res) => global_1.withAdminUser(req, res, changer => withSelectedUser(req, res, user => {
        if (user.uid === 'root' && changer.uid !== 'root')
            return res.status(403).render('error', {
                pageTitle: 'Can\'t change user\'s quotas',
                errorText: 'Only root can change root\'s quota',
            });
        const quota = +req.body.quota;
        const unit = +req.body.unit;
        const filesLimit = +req.body.filesLimit;
        if (isNaN(quota) || quota < 0 || isNaN(unit) || unit <= 0 || isNaN(filesLimit) || filesLimit < 0)
            return res.status(400).render('error', {
                pageTitle: 'Error 400: Bad request',
                errorText: 'Give me all inputs',
            });
        user.quota = quota * unit | 0;
        user.maxFiles = filesLimit | 0;
        res.redirect(303, '.');
    })));
}
exports.init = init;

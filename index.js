const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } = require('discord.js');
const config = require('./config.json');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
    ],
});

const commands = [
    {
        name: 'role',
        description: 'Assign a role to a user or everyone',
        options: [
            {
                name: 'role',
                type: 8,
                description: 'The role to assign',
                required: true,
            },
            {
                name: 'user',
                type: 6,
                description: 'The user to assign the role to (leave empty to assign to everyone)',
                required: false,
            },
        ],
    },
    {
        name: 'unbanall',
        description: 'Unban all banned members in the server',
    },
];

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands });
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;

    if (commandName === 'role') {
        const role = options.getRole('role');
        const user = options.getUser('user');
        await interaction.deferReply();

        if (user) {
            try {
                const guildMember = await interaction.guild.members.fetch(user.id);
                await guildMember.roles.add(role);
                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('Red')
                            .setTitle('Role Assigned')
                            .setDescription(`Successfully assigned the role **${role.name}** to **${user.username}**.`)
                            .setTimestamp(),
                    ],
                });
            } catch (error) {
                console.error(error);
                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('DarkRed')
                            .setTitle('Error')
                            .setDescription('Failed to assign the role. Check my permissions.')
                            .setTimestamp(),
                    ],
                });
            }
        } else {
            try {
                const members = await interaction.guild.members.fetch({ withPresences: false });
                let successCount = 0;
                let failCount = 0;
                const totalMembers = members.size;
                const embed = new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('Role Assignment Progress')
                    .setDescription(`Assigning role **${role.name}** to all members...`)
                    .addFields(
                        { name: 'Success', value: '0', inline: true },
                        { name: 'Failed', value: '0', inline: true },
                        { name: 'Progress', value: '0%', inline: true }
                    );
                const progressMessage = await interaction.editReply({ embeds: [embed] });
                const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

                for (const member of members.values()) {
                    if (!member.roles.cache.has(role.id)) {
                        try {
                            await member.roles.add(role);
                            successCount++;
                        } catch (error) {
                            console.error(`Failed to assign role to ${member.user.tag}:`, error);
                            failCount++;
                        }
                    }

                    if ((successCount + failCount) % 10 === 0 || successCount + failCount === totalMembers) {
                        const progress = Math.round(((successCount + failCount) / totalMembers) * 100);
                        embed.setFields(
                            { name: 'Success', value: `${successCount}`, inline: true },
                            { name: 'Failed', value: `${failCount}`, inline: true },
                            { name: 'Progress', value: `${progress}%`, inline: true }
                        );
                        await progressMessage.edit({ embeds: [embed] });
                    }

                    await delay(50);
                }

                embed
                    .setColor('Red')
                    .setTitle('Role Assignment Complete')
                    .setDescription(
                        `Successfully assigned the role **${role.name}** to **${successCount}** members.\nFailed for **${failCount}** members.`
                    )
                    .setTimestamp();

                await progressMessage.edit({ embeds: [embed] });
            } catch (error) {
                console.error(error);
                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('DarkRed')
                            .setTitle('Error')
                            .setDescription('Failed to assign the role to everyone. Check my permissions.')
                            .setTimestamp(),
                    ],
                });
            }
        }
    } else if (commandName === 'unbanall') {
        await interaction.deferReply();
        try {
            const bans = await interaction.guild.bans.fetch();
            let successCount = 0;
            let failCount = 0;
            const totalBans = bans.size;
            const embed = new EmbedBuilder()
                .setColor('Red')
                .setTitle('Unban Progress')
                .setDescription('Unbanning all banned members...')
                .addFields(
                    { name: 'Success', value: '0', inline: true },
                    { name: 'Failed', value: '0', inline: true },
                    { name: 'Progress', value: '0%', inline: true }
                );
            const progressMessage = await interaction.editReply({ embeds: [embed] });
            const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

            for (const ban of bans.values()) {
                try {
                    await interaction.guild.members.unban(ban.user.id);
                    successCount++;
                } catch {
                    failCount++;
                }

                if ((successCount + failCount) % 10 === 0 || successCount + failCount === totalBans) {
                    const progress = Math.round(((successCount + failCount) / totalBans) * 100);
                    embed.setFields(
                        { name: 'Success', value: `${successCount}`, inline: true },
                        { name: 'Failed', value: `${failCount}`, inline: true },
                        { name: 'Progress', value: `${progress}%`, inline: true }
                    );
                    await progressMessage.edit({ embeds: [embed] });
                }

                await delay(50);
            }

            embed
                .setColor('Red')
                .setTitle('Unban Complete')
                .setDescription(
                    `Successfully unbanned **${successCount}** members.\nFailed to unban **${failCount}** members.`
                )
                .setTimestamp();

            await progressMessage.edit({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('DarkRed')
                        .setTitle('Error')
                        .setDescription('Failed to unban all members. Check my permissions.')
                        .setTimestamp(),
                ],
            });
        }
    }
});

client.login(config.token);

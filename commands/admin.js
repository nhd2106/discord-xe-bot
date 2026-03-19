const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const sheets = require('../sheets');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cho-duyet')
    .setDescription('[Admin] Xem danh sách đơn đăng ký xe đang chờ duyệt'),

  async execute(interaction) {
    // Chỉ admin role mới dùng được
    if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return await interaction.reply({ content: '❌ Bạn không có quyền dùng lệnh này.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const pending = await sheets.getPendingBookings();

      if (pending.length === 0) {
        return await interaction.editReply({ content: '✅ Không có đơn nào đang chờ duyệt.' });
      }

      const embed = new EmbedBuilder()
        .setTitle(`📋 Đơn chờ duyệt (${pending.length})`)
        .setColor(0xF59E0B)
        .setTimestamp();

      pending.forEach(b => {
        embed.addFields({
          name: `[${b.id}] ${b.date} ${b.time} — ${b.destination}`,
          value: `👤 ${b.userName} | 👥 ${b.passengers} người | 🎯 ${b.purpose}`,
        });
      });

      embed.setFooter({ text: 'Dùng nút ✅/❌ trên từng tin nhắn đăng ký để duyệt' });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      await interaction.editReply({ content: '❌ Có lỗi xảy ra.' });
    }
  },
};
